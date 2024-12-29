require("solidity-coverage");

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("TaskMarketplace", function () {
    const TaskStatus = {
        Created: 0,
        InProgress: 1,
        Submitted: 2,
        Disputed: 3,
        Completed: 4,
        Cancelled: 5,
        CompletedWithDeveloperWon: 6,
        CompletedWithProviderWon: 7
    };

    const Role = {
        TaskProvider: 0,
        TaskDeveloper: 1,
        TaskAuditor: 2
    };
    let snapshotId;

    beforeEach(async function () {
        try {
            snapshotId = await network.provider.send("evm_snapshot");
        } catch (error) {
            console.log("Snapshot failed, continuing without snapshot");
        }
        [owner, provider, developer, developer2, auditor1, auditor2, auditor3, auditor4, treasury] = await ethers.getSigners();
        const SoulBoundTokenRole = await ethers.getContractFactory("SoulBoundTokenRole");
        sbtRole = await SoulBoundTokenRole.deploy();
        const SoulBoundAchievement = await ethers.getContractFactory("SoulBoundAchievement");
        sbtAchievement = await SoulBoundAchievement.deploy();
        const SoulBoundRedflag = await ethers.getContractFactory("SoulBoundRedflag");
        sbtRedflag = await SoulBoundRedflag.deploy();
        const TaskMarketplace = await ethers.getContractFactory("TaskMarketplace");
        taskMarketplace = await TaskMarketplace.deploy(
            await sbtRole.getAddress(),
            await sbtAchievement.getAddress(),
            await sbtRedflag.getAddress(),
            treasury.address
        );
        await sbtRole.transferOwnership(await taskMarketplace.getAddress());
        await sbtAchievement.transferOwnership(await taskMarketplace.getAddress());
        await sbtRedflag.transferOwnership(await taskMarketplace.getAddress());

        deadline = (await time.latest()) + time.duration.hours(1);
        reward = ethers.parseEther("1.0"); // 1 ETH
        taskId = 0;
    });

    afterEach(async function () {
        try {
            await network.provider.send("evm_revert", [snapshotId]);
        } catch (error) {
            console.log("Revert failed, continuing without revert");
        }
    });

    describe("Initial State", function () {
        it("Should initialize with correct addresses", async function () {
            expect(await taskMarketplace.sbtContract()).to.equal(await sbtRole.getAddress());
            expect(await taskMarketplace.achievementContract()).to.equal(await sbtAchievement.getAddress());
            expect(await taskMarketplace.redflagContract()).to.equal(await sbtRedflag.getAddress());
            expect(await taskMarketplace.protocolTreasury()).to.equal(treasury.address);
        });
        it("Should initialize with zero task count", async function () {
            expect(await taskMarketplace.taskCount()).to.equal(0);
        });
    });

    describe("Role Management", function () {
        it("Should allow requesting SBT provider role", async function () {
            await taskMarketplace.connect(provider).requestSBT(Role.TaskProvider);
            expect(await sbtRole.hasToken(provider.address)).to.be.true;
        });
        it("Should allow requesting SBT developer role", async function () {
            await taskMarketplace.connect(developer).requestSBT(Role.TaskDeveloper);
            expect(await sbtRole.hasToken(developer.address)).to.be.true;
        })
        it("Should allow requesting SBT auditor role", async function () {
            await taskMarketplace.connect(auditor1).requestSBT(Role.TaskAuditor);
            expect(await sbtRole.hasToken(auditor1.address)).to.be.true;
        })
        it("Should not allow requesting multiple SBTs", async function () {
            await taskMarketplace.connect(provider).requestSBT(Role.TaskProvider);
            await expect(taskMarketplace.connect(provider).requestSBT(Role.TaskDeveloper))
                .to.be.revertedWith("Address already has a SBT");
        });
    });

    describe("Task Creation", function () {
        beforeEach(async function () {
            await taskMarketplace.connect(provider).requestSBT(Role.TaskProvider);
        });

        it("Should create task with correct parameters", async function () {
            await expect(taskMarketplace.connect(provider).createTask("Title: Test Task", "Description: Test Task", deadline, reward))
                .to.emit(taskMarketplace, "TaskCreated")
                .withArgs(taskId, provider.address, "Title: Test Task", reward);

            const task = await taskMarketplace.tasks(taskId);
            expect(task.provider).to.equal(provider.address);
            expect(task.reward).to.equal(reward);
            expect(task.status).to.equal(TaskStatus.Created);
        });
        it("Should calculate rewards correctly", async function () {
            await taskMarketplace.connect(provider).createTask("Title: Test Task", "Description: Test Task", deadline, reward);
            const task = await taskMarketplace.tasks(taskId);
            expect(task.developerReward).to.equal((reward * BigInt(67)) / BigInt(100));
            expect(task.auditorReward).to.equal((reward * BigInt(10)) / BigInt(100));
        });
        it("Should not allow creating task with zero reward", async function () {
            await expect(taskMarketplace.connect(provider).createTask("Title: Test Task", "Description: Test Task", deadline, 0))
                .to.be.revertedWith("Reward must be greater than 0");
        });
        it("Should return the correct taskDetails", async function () {
            await taskMarketplace.connect(provider).createTask("Title: Test Task", "Description: Test Task", deadline, reward);
            const taskDetails = await taskMarketplace.getTasksDetails([taskId]);
            expect(taskDetails[0].description).to.equal("Description: Test Task");
            expect(taskDetails[0].reward).to.equal(reward);
            expect(taskDetails[0].deadline).to.equal(deadline);
        });

        it("Should return the tasks for a provider", async function () {
            await taskMarketplace.connect(provider).createTask("Title: Test Task", "Description: Test Task", deadline, reward);
            const taskIds = await taskMarketplace.getAllProviderTasks(provider.address);
            expect(taskIds).to.deep.equal([taskId]);
        });
    });

    describe("Task Application", function () {
        beforeEach(async function () {
            await taskMarketplace.connect(provider).requestSBT(Role.TaskProvider);
            await taskMarketplace.connect(developer).requestSBT(Role.TaskDeveloper);
            await taskMarketplace.connect(auditor1).requestSBT(Role.TaskAuditor);
            await taskMarketplace.connect(auditor2).requestSBT(Role.TaskAuditor);
            await taskMarketplace.connect(auditor3).requestSBT(Role.TaskAuditor);
            await taskMarketplace.connect(provider).createTask("Title: Test Task", "Description: Test Task", deadline, reward);
        });
        it("Should allow developer to apply", async function () {
            await expect(taskMarketplace.connect(developer).applyForTaskAsDeveloper(taskId))
                .to.emit(taskMarketplace, "DeveloperSubmitted")
                .withArgs(taskId, developer.address);
        });
        it("Should not allow more than MAX_CANDIDATES developers", async function () {
            const signers = await ethers.getSigners();
            for (let i = 0; i < 15; i++) {
                const dev = signers[i + 9];
                await taskMarketplace.connect(dev).requestSBT(Role.TaskDeveloper);
                await taskMarketplace.connect(dev).applyForTaskAsDeveloper(taskId);
            }
            const lastDev = signers[15 + 9];
            await taskMarketplace.connect(lastDev).requestSBT(Role.TaskDeveloper);
            await expect(taskMarketplace.connect(lastDev).applyForTaskAsDeveloper(taskId)).to.be.revertedWith("Maximum developer candidates reached");
        });
        it("Should not allow auditor to apply as developer", async function () {
            await expect(taskMarketplace.connect(auditor1).applyForTaskAsDeveloper(taskId)).to.be.revertedWith("Sender must be a TaskDeveloper");
        });
        it("Should allow auditor to apply", async function () {
            await expect(taskMarketplace.connect(auditor1).applyForTaskAsAuditor(taskId))
                .to.emit(taskMarketplace, "AuditorSubmitted")
                .withArgs(taskId, auditor1.address);
        });
        it("Should not allow developer to apply as auditor", async function () {
            await expect(taskMarketplace.connect(developer).applyForTaskAsAuditor(taskId)).to.be.revertedWith("Sender must be a TaskAuditor");
        });
        it("Should not allow more than MAX_CANDIDATES auditors", async function () {
            const signers = await ethers.getSigners();
            for (let i = 0; i < 15; i++) {
                const auditor = signers[i + 9];
                await taskMarketplace.connect(auditor).requestSBT(Role.TaskAuditor);
                await taskMarketplace.connect(auditor).applyForTaskAsAuditor(taskId);
            }
            const lastDev = signers[15 + 9];
            await taskMarketplace.connect(lastDev).requestSBT(Role.TaskAuditor);
            await expect(taskMarketplace.connect(lastDev).applyForTaskAsAuditor(taskId)).to.be.revertedWith("Maximum auditors candidates reached");
        });
        it("Should add developer to developerCandidates", async function () {
            await taskMarketplace.connect(developer).applyForTaskAsDeveloper(taskId);
            expect(await taskMarketplace.getDeveloperCandidates(taskId)).to.include(developer.address);
        });
        it("Should not allow developer to apply twice", async function () {
            await taskMarketplace.connect(developer).applyForTaskAsDeveloper(taskId);
            await expect(taskMarketplace.connect(developer).applyForTaskAsDeveloper(taskId)).to.be.revertedWith("Already applied for this task");
        });
        it("Should add auditor to auditors", async function () {
            await taskMarketplace.connect(auditor1).applyForTaskAsAuditor(taskId);
            expect(await taskMarketplace.getTaskAuditors(taskId)).to.include(auditor1.address);
        });
        it("Should not allow auditor to apply twice", async function () {
            await taskMarketplace.connect(auditor1).applyForTaskAsAuditor(taskId);
            await expect(taskMarketplace.connect(auditor1).applyForTaskAsAuditor(taskId)).to.be.revertedWith("Already applied for this task");
        });
        it("Should not allow auditor to apply for a task that is not open for applications", async function () {
            await taskMarketplace.connect(developer).applyForTaskAsDeveloper(taskId);
            await taskMarketplace.connect(auditor1).applyForTaskAsAuditor(taskId);
            await taskMarketplace.connect(auditor2).applyForTaskAsAuditor(taskId);
            await taskMarketplace.connect(auditor3).applyForTaskAsAuditor(taskId);
            await taskMarketplace.connect(provider).assignDeveloper(taskId, developer.address);
            await taskMarketplace.connect(provider).startTask(taskId, { value: reward });
            await expect(taskMarketplace.connect(auditor1).applyForTaskAsAuditor(taskId)).to.be.revertedWith("Task not open for auditor applications");
        });
        it("Should not allow developer to apply for a task that is not open for applications", async function () {
            await taskMarketplace.connect(developer).applyForTaskAsDeveloper(taskId);
            await taskMarketplace.connect(auditor1).applyForTaskAsAuditor(taskId);
            await taskMarketplace.connect(auditor2).applyForTaskAsAuditor(taskId);
            await taskMarketplace.connect(auditor3).applyForTaskAsAuditor(taskId);
            await taskMarketplace.connect(provider).assignDeveloper(taskId, developer.address);
            await taskMarketplace.connect(provider).startTask(taskId, { value: reward });
            await expect(taskMarketplace.connect(developer).applyForTaskAsDeveloper(taskId)).to.be.revertedWith("Task not open for developer applications");
        });
        it("Should return the tasks for an auditor", async function () {
            await taskMarketplace.connect(auditor1).applyForTaskAsAuditor(taskId);
            const taskIds = await taskMarketplace.getAllAuditorTasks(auditor1.address);
            expect(taskIds).to.deep.equal([taskId]);
        });
    });

    describe("Task Assignment", function () {
        beforeEach(async function () {
            await taskMarketplace.connect(provider).requestSBT(Role.TaskProvider);
            await taskMarketplace.connect(developer).requestSBT(Role.TaskDeveloper);
            await taskMarketplace.connect(auditor1).requestSBT(Role.TaskAuditor);
            await taskMarketplace.connect(auditor2).requestSBT(Role.TaskAuditor);
            await taskMarketplace.connect(auditor3).requestSBT(Role.TaskAuditor);
            await taskMarketplace.connect(provider).createTask("Title: Test Task", "Description: Test Task", deadline, reward);
        });
        it("Should not allow non-provider to assign developer", async function () {
            await expect(taskMarketplace.connect(auditor1).assignDeveloper(taskId, developer.address)).to.be.revertedWith("Sender must be a TaskProvider");
        });
        it("Should revert if no developer candidates", async function () {
            await expect(taskMarketplace.connect(provider).assignDeveloper(taskId, developer.address)).to.be.revertedWith("No developer candidates");
        });
        it("Should not allow assigning developer who hasn't applied", async function () {
            await taskMarketplace.connect(developer).applyForTaskAsDeveloper(taskId);
            await expect(taskMarketplace.connect(provider).assignDeveloper(taskId, auditor1.address))
                .to.be.revertedWith("Developer has not applied for this task");
        });
        it("Should allow assigning developer who has applied", async function () {
            await taskMarketplace.connect(developer).applyForTaskAsDeveloper(taskId);
            await expect(taskMarketplace.connect(provider).assignDeveloper(taskId, developer.address))
                .to.emit(taskMarketplace, "DeveloperAssigned")
                .withArgs(taskId, developer.address);
        });
        it("Should set the task developer", async function () {
            await taskMarketplace.connect(developer).applyForTaskAsDeveloper(taskId);
            await taskMarketplace.connect(provider).assignDeveloper(taskId, developer.address);
            const task = await taskMarketplace.tasks(taskId);
            expect(task.developer).to.equal(developer.address);
        });
        it("Should return the tasks for a developer", async function () {
            await taskMarketplace.connect(developer).applyForTaskAsDeveloper(taskId);
            await taskMarketplace.connect(provider).assignDeveloper(taskId, developer.address);
            const taskIds = await taskMarketplace.getAllDeveloperTasks(developer.address);
            expect(taskIds).to.deep.equal([taskId]);
        });
    });

    describe("Task Start", function () {
        beforeEach(async function () {
            await taskMarketplace.connect(provider).requestSBT(Role.TaskProvider);
            await taskMarketplace.connect(developer).requestSBT(Role.TaskDeveloper);
            await taskMarketplace.connect(auditor1).requestSBT(Role.TaskAuditor);
            await taskMarketplace.connect(auditor2).requestSBT(Role.TaskAuditor);
            await taskMarketplace.connect(auditor3).requestSBT(Role.TaskAuditor);
            await taskMarketplace.connect(provider).createTask("Title: Test Task", "Description: Test Task", deadline, reward);
            await taskMarketplace.connect(developer).applyForTaskAsDeveloper(taskId);
            for (const auditor of [auditor1, auditor2]) {
                await taskMarketplace.connect(auditor).applyForTaskAsAuditor(taskId);
            }
        });
        it("Should not allow non-provider to start task", async function () {
            await expect(taskMarketplace.connect(developer).startTask(taskId, { value: reward }))
                .to.be.revertedWith("Sender must be a TaskProvider");
        });
        it("Should not allow starting without a developer", async function () {
            await expect(taskMarketplace.connect(provider).startTask(taskId, { value: reward }))
                .to.be.revertedWith("Developer not assigned");
        });
        it("Should not allow starting without enough auditors", async function () {
            await taskMarketplace.connect(provider).assignDeveloper(taskId, developer.address);
            await expect(taskMarketplace.connect(provider).startTask(taskId, { value: reward }))
                .to.be.revertedWith("Not enough auditors assigned");
        });
        it("Should not allow starting without enough reward", async function () {
            await taskMarketplace.connect(auditor3).applyForTaskAsAuditor(taskId);
            await taskMarketplace.connect(provider).assignDeveloper(taskId, developer.address);
            await expect(taskMarketplace.connect(provider).startTask(taskId, { value: ethers.parseEther("0.01") }))
                .to.be.revertedWith("Payment must match announced reward");
        });
        it("Should start task with correct parameters", async function () {
            await taskMarketplace.connect(auditor3).applyForTaskAsAuditor(taskId);
            await taskMarketplace.connect(provider).assignDeveloper(taskId, developer.address);
            await taskMarketplace.connect(provider).startTask(taskId, { value: reward });
            const task = await taskMarketplace.tasks(taskId);
            expect(task.status).to.equal(TaskStatus.InProgress);
        });
        it("Should create an escrow", async function () {
            await taskMarketplace.connect(auditor3).applyForTaskAsAuditor(taskId);
            await taskMarketplace.connect(provider).assignDeveloper(taskId, developer.address);
            await taskMarketplace.connect(provider).startTask(taskId, { value: reward });
            const task = await taskMarketplace.tasks(taskId);
            expect(task.escrowAddress).to.not.be.null;
        });
        it("Should emit TaskStarted event", async function () {
            await taskMarketplace.connect(auditor3).applyForTaskAsAuditor(taskId);
            await taskMarketplace.connect(provider).assignDeveloper(taskId, developer.address);
            await expect(taskMarketplace.connect(provider).startTask(taskId, { value: reward }))
                .to.emit(taskMarketplace, "TaskStarted");
        });
        it("Should emit TaskStatusUpdated event", async function () {
            await taskMarketplace.connect(auditor3).applyForTaskAsAuditor(taskId);
            await taskMarketplace.connect(provider).assignDeveloper(taskId, developer.address);
            await expect(taskMarketplace.connect(provider).startTask(taskId, { value: reward }))
                .to.emit(taskMarketplace, "TaskStatusUpdated")
                .withArgs(taskId, TaskStatus.InProgress);
        });
    });

    describe("Task Completion", function () {
        beforeEach(async function () {
            await taskMarketplace.connect(provider).requestSBT(Role.TaskProvider);
            await taskMarketplace.connect(developer).requestSBT(Role.TaskDeveloper);
            await taskMarketplace.connect(auditor1).requestSBT(Role.TaskAuditor);
            await taskMarketplace.connect(auditor2).requestSBT(Role.TaskAuditor);
            await taskMarketplace.connect(auditor3).requestSBT(Role.TaskAuditor);
            await taskMarketplace.connect(provider).createTask("Title: Test Task", "Description: Test Task", deadline, reward);
            await taskMarketplace.connect(developer).applyForTaskAsDeveloper(0);
            for (const auditor of [auditor1, auditor2, auditor3]) {
                await taskMarketplace.connect(auditor).applyForTaskAsAuditor(taskId);
            }
            await taskMarketplace.connect(provider).assignDeveloper(taskId, developer.address);
        });
        it("Should not allow non-provider to complete task", async function () {
            await expect(taskMarketplace.connect(developer).completeTask(taskId))
            .to.be.revertedWith("Sender must be a TaskProvider");
        });
        it("Should not allow completing task that is not in progress", async function () {
            await expect(taskMarketplace.connect(provider).completeTask(taskId))
            .to.be.revertedWith("Task not in correct state");
        });
        it("Should allow provider to complete task", async function () {
            await taskMarketplace.connect(provider).startTask(taskId, { value: reward });
            await taskMarketplace.connect(provider).completeTask(taskId);
            const task = await taskMarketplace.tasks(taskId);
            expect(task.status).to.equal(TaskStatus.Completed);
        });
        it("Should emit TaskStatusUpdated event", async function () {
            await taskMarketplace.connect(provider).startTask(taskId, { value: reward });
            await expect(taskMarketplace.connect(provider).completeTask(taskId))
                .to.emit(taskMarketplace, "TaskStatusUpdated")
                .withArgs(taskId, TaskStatus.Completed);
        });
        it("Should emit TaskCompleted event", async function () {
            await taskMarketplace.connect(provider).startTask(0, { value: reward });
            await expect(taskMarketplace.connect(provider).completeTask(0))
                .to.emit(sbtAchievement, "TaskCompleted");
        });
        it("Should not allow developer to apply for task in wrong state", async function () {
            await taskMarketplace.connect(provider).startTask(taskId, { value: reward });
            await taskMarketplace.connect(developer2).requestSBT(Role.TaskDeveloper);
            await expect(taskMarketplace.connect(developer2).applyForTaskAsDeveloper(taskId))
                .to.be.revertedWith("Task not open for developer applications");
        });
        it("Should not allow auditor to apply for task in wrong state", async function () {
            await taskMarketplace.connect(provider).startTask(taskId, { value: reward });
            await taskMarketplace.connect(auditor4).requestSBT(Role.TaskAuditor);
            await expect(taskMarketplace.connect(auditor4).applyForTaskAsAuditor(taskId))
                .to.be.revertedWith("Task not open for auditor applications");
        });
        it("Should not allow provider to assign developer in wrong state", async function () {
            await taskMarketplace.connect(provider).startTask(taskId, { value: reward });
            await expect(taskMarketplace.connect(provider).assignDeveloper(taskId, developer.address))
                .to.be.revertedWith("Task not in correct state");
        });
        it("Should not allow provider to start task in wrong state", async function () {
            await taskMarketplace.connect(provider).startTask(taskId, { value: reward });
            await expect(taskMarketplace.connect(provider).startTask(taskId, { value: reward }))
                .to.be.revertedWith("Task not in correct state");
        });
    });

    // describe("Task Withdrawal", function () {
    //     beforeEach(async function () {
    //         await taskMarketplace.connect(provider).requestSBT(Role.TaskProvider);
    //         await taskMarketplace.connect(developer).requestSBT(Role.TaskDeveloper);
    //         await taskMarketplace.connect(auditor1).requestSBT(Role.TaskAuditor);
    //         await taskMarketplace.connect(auditor2).requestSBT(Role.TaskAuditor);
    //         await taskMarketplace.connect(auditor3).requestSBT(Role.TaskAuditor);
    //         await taskMarketplace.connect(provider).createTask("Title: Test Task", "Description: Test Task", deadline, reward);
    //     });
    // });


    // describe("Payment Handling", function () {
    //     beforeEach(async function () {
    //         await taskMarketplace.connect(provider).requestSBT(Role.TaskProvider);
    //         await taskMarketplace.connect(developer).requestSBT(Role.TaskDeveloper);
    //         await taskMarketplace.connect(developer2).requestSBT(Role.TaskDeveloper);
    //         await taskMarketplace.connect(auditor1).requestSBT(Role.TaskAuditor);
    //         await taskMarketplace.connect(auditor2).requestSBT(Role.TaskAuditor);
    //         await taskMarketplace.connect(auditor3).requestSBT(Role.TaskAuditor);
    //         await taskMarketplace.connect(auditor4).requestSBT(Role.TaskAuditor);
    //         await taskMarketplace.connect(provider).createTask("Title: Test Task", "Description: Test Task", deadline, reward);
    //         await taskMarketplace.connect(developer).applyForTaskAsDeveloper(0);
    //         await taskMarketplace.connect(provider).assignDeveloper(0, developer.address);
    //         for (const auditor of [auditor1, auditor2, auditor3]) {
    //             await taskMarketplace.connect(auditor).applyForTaskAsAuditor(0);
    //             await taskMarketplace.connect(provider).assignAuditor(0, auditor.address);
    //         }
    //         await taskMarketplace.connect(provider).startTask(0, { value: reward });
    //         await taskMarketplace.connect(provider).completeTask(0);
    //     });
    //     it("Should not allow provider to withdraw payment in wrong state", async function () {
    //         await expect(taskMarketplace.connect(provider).withdrawPayment(0))
    //             .to.be.revertedWith("Invalid role for withdrawal");
    //     });
    //     it("Should not allow the wrong developer to withdraw payment", async function () {
    //         await expect(taskMarketplace.connect(developer2).withdrawPayment(0))
    //             .to.be.revertedWith("Not the task developer");
    //     });
    //     it("Should not allow the wrong auditor to withdraw payment", async function () {
    //         await expect(taskMarketplace.connect(auditor4).withdrawPayment(0))
    //             .to.be.revertedWith("Not an auditor of this task");
    //     });
    //     it("Should allow developer to withdraw payment after task completion", async function () {
    //         await taskMarketplace.connect(provider).completeTask(0);
    //         const initialBalance = await ethers.provider.getBalance(developer.address);
            
    //         await taskMarketplace.connect(developer).withdrawPayment(0);
            
    //         const finalBalance = await ethers.provider.getBalance(developer.address);
    //         const expectedReward = (reward * 67n) / 100n; // DEVELOPER_SHARE = 67%
    //         expect(finalBalance - initialBalance).to.be.closeTo(expectedReward, ethers.parseEther("0.01"));
    //     });
    //     it("Should allow auditors to withdraw their share", async function () {
    //         await taskMarketplace.connect(provider).completeTask(0);
            
    //         for (const auditor of [auditor1, auditor2, auditor3]) {
    //             const initialBalance = await ethers.provider.getBalance(auditor.address);
    //             await taskMarketplace.connect(auditor).withdrawPayment(0);
    //             const finalBalance = await ethers.provider.getBalance(auditor.address);
                
    //             const expectedReward = (reward * 10n) / 100n; // AUDITOR_SHARE = 10%
    //             expect(finalBalance - initialBalance).to.be.closeTo(expectedReward, ethers.parseEther("0.01"));
    //         }
    //     });
    //     it("Should verify protocol fee transfer", async function () {
    //         const initialTreasuryBalance = await ethers.provider.getBalance(treasury.address);
    //         await taskMarketplace.connect(provider).startTask(0, { value: reward });
    //         const finalTreasuryBalance = await ethers.provider.getBalance(treasury.address);
            
    //         const expectedFee = (reward * 3n) / 100n; // PROTOCOL_FEE = 3%
    //         expect(finalTreasuryBalance - initialTreasuryBalance).to.equal(expectedFee);
    //     });
    // });

    describe("Utility functions", function () {
        beforeEach(async function () {
            await taskMarketplace.connect(provider).requestSBT(Role.TaskProvider);
            await taskMarketplace.connect(developer).requestSBT(Role.TaskDeveloper);
            await taskMarketplace.connect(auditor1).requestSBT(Role.TaskAuditor);
            await taskMarketplace.connect(auditor2).requestSBT(Role.TaskAuditor);
            await taskMarketplace.connect(auditor3).requestSBT(Role.TaskAuditor);
        });
        it("Should allow getting task's auditors", async function () {
            await taskMarketplace.connect(provider).createTask("Title: Test Task", "Description: Test Task", deadline, reward);
            for (const auditor of [auditor1, auditor2, auditor3]) {
                await taskMarketplace.connect(auditor).applyForTaskAsAuditor(taskId);
            }
            const auditors = await taskMarketplace.getTaskAuditors(taskId);
            expect(auditors).to.deep.equal([auditor1.address, auditor2.address, auditor3.address]);
        });
    });

    describe("Task Submission and Acceptance", function () {
        beforeEach(async function () {
            await taskMarketplace.connect(provider).requestSBT(Role.TaskProvider);
            await taskMarketplace.connect(developer).requestSBT(Role.TaskDeveloper);
            await taskMarketplace.connect(auditor1).requestSBT(Role.TaskAuditor);
            await taskMarketplace.connect(auditor2).requestSBT(Role.TaskAuditor);
            await taskMarketplace.connect(auditor3).requestSBT(Role.TaskAuditor);
            await taskMarketplace.connect(provider).createTask("Title: Test Task", "Description: Test Task", deadline, reward);
            await taskMarketplace.connect(developer).applyForTaskAsDeveloper(taskId);
            for (const auditor of [auditor1, auditor2, auditor3]) {
                await taskMarketplace.connect(auditor).applyForTaskAsAuditor(taskId);
            }
            await taskMarketplace.connect(provider).assignDeveloper(taskId, developer.address);
            await taskMarketplace.connect(provider).startTask(taskId, { value: reward });
        });
        it("Should allow developer to submit work", async function () {
            await expect(taskMarketplace.connect(developer).submitWork(taskId))
                .to.emit(taskMarketplace, "WorkSubmitted");
        });
        it("Should not allow non-developer to submit work", async function () {
            await expect(taskMarketplace.connect(auditor1).submitWork(taskId))
                .to.be.revertedWith("Sender must be a TaskDeveloper");
        });
        it("Should allow provider to accept work", async function () {
            await taskMarketplace.connect(developer).submitWork(taskId);
            await expect(taskMarketplace.connect(provider).acceptWork(taskId)).to.emit(taskMarketplace, "WorkAccepted")
        });
        it("Should not allow accepting work that hasn't been submitted", async function () {
            await expect(taskMarketplace.connect(provider).acceptWork(taskId)).to.be.revertedWith("Work not submitted");
        });
        it("Should not allow submission after deadline", async function () {
            await time.increase(3601);
            await expect(taskMarketplace.connect(developer).submitWork(taskId)).to.be.revertedWith("Task deadline passed");
        });
    });

    describe("Dispute Resolution", function () {
        beforeEach(async function () {
            await taskMarketplace.connect(provider).requestSBT(Role.TaskProvider);
            await taskMarketplace.connect(developer).requestSBT(Role.TaskDeveloper);
            await taskMarketplace.connect(auditor1).requestSBT(Role.TaskAuditor);
            await taskMarketplace.connect(auditor2).requestSBT(Role.TaskAuditor);
            await taskMarketplace.connect(auditor3).requestSBT(Role.TaskAuditor);
            await taskMarketplace.connect(provider).createTask("Title: Test Task", "Description: Test Task", deadline, reward);
            await taskMarketplace.connect(developer).applyForTaskAsDeveloper(taskId);
            for (const auditor of [auditor1, auditor2, auditor3]) {
                await taskMarketplace.connect(auditor).applyForTaskAsAuditor(taskId);
            }
            await taskMarketplace.connect(provider).assignDeveloper(taskId, developer.address);
            await taskMarketplace.connect(provider).startTask(taskId, { value: reward });
        });
        it("Should not allow provider to initiate dispute if work is not submitted", async function () {
            await expect(taskMarketplace.connect(provider).initiateDispute(taskId)).to.be.revertedWith("Work not submitted");
        });
        it("Should allow provider to initiate dispute", async function () {
            await taskMarketplace.connect(developer).submitWork(taskId);
            await expect(taskMarketplace.connect(provider).initiateDispute(taskId)).to.emit(taskMarketplace, "DisputeInitiated")
        });
        it("Should allow developer to initiate dispute", async function () {
            await taskMarketplace.connect(developer).submitWork(taskId);
            await expect(taskMarketplace.connect(developer).initiateDispute(taskId)).to.emit(taskMarketplace, "DisputeInitiated")
        });
        it("Should not allow other to initiate dispute", async function () {
            await taskMarketplace.connect(developer).submitWork(taskId);
            await expect(taskMarketplace.connect(auditor1).initiateDispute(taskId))
                .to.be.revertedWith("Not authorized");
        });
        it("Should set the dispute deadline", async function () {
            await taskMarketplace.connect(developer).submitWork(taskId);
            await taskMarketplace.connect(provider).initiateDispute(taskId);
            const task = await taskMarketplace.tasks(taskId);
            expect(task.votingDeadline).to.be.closeTo(await time.latest() + time.duration.weeks(1), 1000);
        });

        describe("Voting", function () {
            beforeEach(async function () {
                await taskMarketplace.connect(developer).submitWork(taskId);
            });
            it("Should not allow to vote in wrong state", async function () {
                await expect(taskMarketplace.connect(auditor1).submitAuditVote(taskId, true))
                    .to.be.revertedWith("Task not disputed");
            });
            it("Should not allow provider to vote", async function () {
                await taskMarketplace.connect(provider).initiateDispute(taskId);
                await expect(taskMarketplace.connect(provider).submitAuditVote(taskId, true))
                    .to.be.revertedWith("Sender must be a TaskAuditor");
            });
            it("Should allow auditors to vote", async function () {
                await taskMarketplace.connect(provider).initiateDispute(taskId);
                await expect(taskMarketplace.connect(auditor1).submitAuditVote(taskId, true))
                    .to.emit(taskMarketplace, "AuditorVoteSubmitted")
                    .withArgs(taskId, auditor1.address, true);
            });
            it("Should not allow non-auditors to vote", async function () {
                await taskMarketplace.connect(provider).initiateDispute(taskId);
                await expect(taskMarketplace.connect(developer).submitAuditVote(taskId, true))
                    .to.be.revertedWith("Sender must be a TaskAuditor");
            });
            it("Should not allow voting twice", async function () {
                await taskMarketplace.connect(provider).initiateDispute(taskId);
                await taskMarketplace.connect(auditor1).submitAuditVote(taskId, true);
                await expect(taskMarketplace.connect(auditor1).submitAuditVote(taskId, true))
                    .to.be.revertedWith("Already voted");
            });
            it("Should resolve dispute after three votes", async function () {
                await taskMarketplace.connect(provider).initiateDispute(taskId);
                await taskMarketplace.connect(auditor1).submitAuditVote(taskId, true);
                await taskMarketplace.connect(auditor2).submitAuditVote(taskId, true);
                await expect(taskMarketplace.connect(auditor3).submitAuditVote(taskId, true))
                    .to.emit(taskMarketplace, "DisputeResolved")
                    .withArgs(taskId, true);
            });
            it("Should not allow to vote after deadline", async function () {
                await taskMarketplace.connect(provider).initiateDispute(taskId);
                await time.increase(time.duration.weeks(1) + 1);
                await expect(taskMarketplace.connect(auditor1).submitAuditVote(taskId, true))
                    .to.be.revertedWith("Voting period has ended");
            });
            it("Should set votesFor to 1", async function () {
                await taskMarketplace.connect(provider).initiateDispute(taskId);
                await taskMarketplace.connect(auditor1).submitAuditVote(taskId, true);
                const vote = await taskMarketplace.getVoteStatus(taskId);
                expect(vote.votesFor).to.be.equal(1);
            });
            it("Should set totalVotes to 3", async function () {
                await taskMarketplace.connect(provider).initiateDispute(taskId);
                await taskMarketplace.connect(auditor1).submitAuditVote(taskId, true);
                await taskMarketplace.connect(auditor2).submitAuditVote(taskId, true);
                await taskMarketplace.connect(auditor3).submitAuditVote(taskId, true);
                const vote = await taskMarketplace.getVoteStatus(taskId);
                expect(vote.totalVotes).to.be.equal(3);
            });
            it("Should set isComplete to true", async function () {
                await taskMarketplace.connect(provider).initiateDispute(taskId);
                await taskMarketplace.connect(auditor1).submitAuditVote(taskId, true);
                await taskMarketplace.connect(auditor2).submitAuditVote(taskId, true);
                await taskMarketplace.connect(auditor3).submitAuditVote(taskId, true);
                const vote = await taskMarketplace.getVoteStatus(taskId);
                expect(vote.isComplete).to.be.true;
            });
            it("Should set isComplete to false", async function () {
                await taskMarketplace.connect(provider).initiateDispute(taskId);
                await taskMarketplace.connect(auditor1).submitAuditVote(taskId, true);
                await taskMarketplace.connect(auditor2).submitAuditVote(taskId, false);
                const vote = await taskMarketplace.getVoteStatus(taskId);
                expect(vote.isComplete).to.be.false;
            });
            it("Should emit DisputeResolved event with true if developer won", async function () {
                await taskMarketplace.connect(provider).initiateDispute(taskId);
                await taskMarketplace.connect(auditor1).submitAuditVote(taskId, true);
                await taskMarketplace.connect(auditor2).submitAuditVote(taskId, true);
                await expect(taskMarketplace.connect(auditor3).submitAuditVote(taskId, true))
                    .to.emit(taskMarketplace, "DisputeResolved")
                    .withArgs(taskId, true);
            });
            it("Should emit DisputeResolved event with false if developer lost", async function () {
                await taskMarketplace.connect(provider).initiateDispute(taskId);
                await taskMarketplace.connect(auditor1).submitAuditVote(taskId, false);
                await taskMarketplace.connect(auditor2).submitAuditVote(taskId, false);
                await expect(taskMarketplace.connect(auditor3).submitAuditVote(taskId, false))
                    .to.emit(taskMarketplace, "DisputeResolved")
                    .withArgs(taskId, false);
            });
            it("Should set the status to CompletedWithProviderWon", async function () {
                await taskMarketplace.connect(provider).initiateDispute(taskId);
                await taskMarketplace.connect(auditor1).submitAuditVote(taskId, false);
                await taskMarketplace.connect(auditor2).submitAuditVote(taskId, false);
                await taskMarketplace.connect(auditor3).submitAuditVote(taskId, false);
                const task = await taskMarketplace.tasks(taskId);
                expect(task.status).to.equal(TaskStatus.CompletedWithProviderWon);
            });
            it("Should set the status to CompletedWithDeveloperWon", async function () {
                await taskMarketplace.connect(provider).initiateDispute(taskId);
                await taskMarketplace.connect(auditor1).submitAuditVote(taskId, true);
                await taskMarketplace.connect(auditor2).submitAuditVote(taskId, true);
                await taskMarketplace.connect(auditor3).submitAuditVote(taskId, true);
                const task = await taskMarketplace.tasks(taskId);
                expect(task.status).to.equal(TaskStatus.CompletedWithDeveloperWon);
            });
        });
    });

    describe("Deadline Management", function () {
        beforeEach(async function () {
            await taskMarketplace.connect(provider).requestSBT(Role.TaskProvider);
            await taskMarketplace.connect(developer).requestSBT(Role.TaskDeveloper);
            await taskMarketplace.connect(provider).createTask("Title: Test Task", "Description: Test Task", deadline, reward);
        });

        it("Should allow provider to update deadline", async function () {
            const newDeadline = deadline + 3600;
            await expect(taskMarketplace.connect(provider).updateTaskDeadline(taskId, newDeadline))
                .to.emit(taskMarketplace, "TaskDeadlineUpdated")
                .withArgs(taskId, newDeadline);
        });

        it("Should not allow non-provider to update deadline", async function () {
            await expect(taskMarketplace.connect(developer).updateTaskDeadline(taskId, deadline + 3600))
                .to.be.revertedWith("Sender must be a TaskProvider");
        });

        it("Should not allow updating deadline of started task", async function () {
            await taskMarketplace.connect(developer).applyForTaskAsDeveloper(taskId);
            await taskMarketplace.connect(provider).assignDeveloper(taskId, developer.address);
            for (const auditor of [auditor1, auditor2, auditor3]) {
                await taskMarketplace.connect(auditor).requestSBT(Role.TaskAuditor);
                await taskMarketplace.connect(auditor).applyForTaskAsAuditor(taskId);
            }
            await taskMarketplace.connect(provider).startTask(taskId, { value: reward });

            await expect(taskMarketplace.connect(provider).updateTaskDeadline(taskId, deadline + 3600))
                .to.be.revertedWith("Task not in correct state");
        });
    });
}); 
