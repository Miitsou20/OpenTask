require("solidity-coverage");

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TaskEscrow", function () {
    const PaymentStatus = {
        None: 0,
        WorkAccepted: 1,
        DeveloperWon: 2,
        ProviderWon: 3,
        Cancelled: 4
    };

    const Role = {
        TaskProvider: 0,
        TaskDeveloper: 1,
        TaskAuditor: 2
    };

    beforeEach(async function () {
        [owner, provider, developer, auditor1, auditor2, auditor3, auditor4, treasury] = await ethers.getSigners();
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

        const MockReceiver = await ethers.getContractFactory("MockReceiver");
        mockReceiver = await MockReceiver.deploy();

        reward = ethers.parseEther("1.0");
        deadline = Math.floor(Date.now() / 1000) + 3600;
        taskId = 0;
        await taskMarketplace.connect(provider).requestSBT(Role.TaskProvider);
        await taskMarketplace.connect(developer).requestSBT(Role.TaskDeveloper);
        await taskMarketplace.connect(auditor1).requestSBT(Role.TaskAuditor);
        await taskMarketplace.connect(auditor2).requestSBT(Role.TaskAuditor);
        await taskMarketplace.connect(auditor3).requestSBT(Role.TaskAuditor);
        await taskMarketplace.connect(auditor4).requestSBT(Role.TaskAuditor);
        await taskMarketplace.connect(provider).createTask("Title: Test Task", "Description: Test Task", deadline, reward);
    });

    describe("Initial State", function () {
        beforeEach(async function () {
            await taskMarketplace.connect(developer).applyForTaskAsDeveloper(taskId);
            await taskMarketplace.connect(provider).assignDeveloper(taskId, developer.address);
            for (const auditor of [auditor1, auditor2, auditor3]) {
                await taskMarketplace.connect(auditor).applyForTaskAsAuditor(taskId);
            }
            await taskMarketplace.connect(provider).startTask(taskId, { value: reward });
            const task = await taskMarketplace.tasks(taskId);
            escrow = await ethers.getContractAt("TaskEscrow", task.escrowAddress);
        });
        it("Should initialize with correct addresses and values", async function () {
            expect(await escrow.provider()).to.equal(provider.address);
            expect(await escrow.developer()).to.equal(developer.address);
            expect(await escrow.taskId()).to.equal(taskId);
            expect(await escrow.reward()).to.equal((reward * 97n) / 100n);
            expect(await escrow.developerReward()).to.equal((reward * 67n) / 100n);
            expect(await escrow.auditorReward()).to.equal((reward * 10n) / 100n);
            expect(await escrow.paymentStatus()).to.equal(PaymentStatus.None);
            expect(await escrow.isDisputed()).to.equal(false);
        });
    });

    describe("Developer Payment", function () {
        beforeEach(async function () {
            await taskMarketplace.connect(developer).applyForTaskAsDeveloper(taskId);
            await taskMarketplace.connect(provider).assignDeveloper(taskId, developer.address);
            for (const auditor of [auditor1, auditor2, auditor3]) {
                await taskMarketplace.connect(auditor).applyForTaskAsAuditor(taskId);
            }
            await taskMarketplace.connect(provider).startTask(taskId, { value: reward });
            const task = await taskMarketplace.tasks(taskId);
            escrow = await ethers.getContractAt("TaskEscrow", task.escrowAddress);
            await taskMarketplace.connect(developer).submitWork(taskId);
            await taskMarketplace.connect(provider).acceptWork(taskId);
        });
        it("Should only allow marketplace to set payment status", async function () {
            await expect(escrow.connect(provider).setPaymentStatus(PaymentStatus.DeveloperWon))
                .to.be.revertedWith("Only marketplace can set payment status");
        });
        it("Should allow developer to withdraw when work is accepted", async function () {
            const initialBalance = await ethers.provider.getBalance(developer.address);
            await taskMarketplace.connect(developer).withdrawPayment(taskId);
            const finalBalance = await ethers.provider.getBalance(developer.address);
            expect(finalBalance).to.be.greaterThan(initialBalance);
        });
        it("Should set hasWithdrawn to true when developer withdraws", async function () {
            await taskMarketplace.connect(developer).withdrawPayment(taskId);
            expect(await escrow.hasWithdrawn(developer.address)).to.be.true;
        });
        it("Should prevent double withdrawal", async function () {
            await taskMarketplace.connect(developer).withdrawPayment(taskId);
            await expect(taskMarketplace.connect(developer).withdrawPayment(taskId))
                .to.be.revertedWith("Already withdrawn");
        });
        it("Should emit DeveloperPaid event when developer withdraws", async function () {
            await expect(taskMarketplace.connect(developer).withdrawPayment(taskId))
                .to.emit(escrow, "DeveloperPaid")
                .withArgs(developer.address, (reward * 97n) / 100n);
        });
    });

    describe("Auditor Payment", function () {
        beforeEach(async function () {
            await taskMarketplace.connect(developer).applyForTaskAsDeveloper(taskId);
            await taskMarketplace.connect(provider).assignDeveloper(taskId, developer.address);
            for (const auditor of [auditor1, auditor2, auditor3]) {
                await taskMarketplace.connect(auditor).applyForTaskAsAuditor(taskId);
            }
            await taskMarketplace.connect(provider).startTask(taskId, { value: reward });
            const task = await taskMarketplace.tasks(taskId);
            escrow = await ethers.getContractAt("TaskEscrow", task.escrowAddress);
            await taskMarketplace.connect(developer).submitWork(taskId);
            await taskMarketplace.connect(provider).initiateDispute(taskId);
            await taskMarketplace.connect(auditor1).submitAuditVote(taskId, true);
            await taskMarketplace.connect(auditor2).submitAuditVote(taskId, true);
        });
        it("Should only allow marketplace to withdraw auditor payment", async function () {
            await taskMarketplace.connect(auditor3).submitAuditVote(taskId, true);
            await expect(escrow.connect(auditor1).withdrawAuditorPayment(auditor1.address))
                .to.be.revertedWith("Only marketplace can withdraw auditor payment");
        });
        it("Should allow majority auditors, 3 of 3 to withdraw 1/3 of the 30% of the reward", async function () {
            await taskMarketplace.connect(auditor3).submitAuditVote(taskId, true);
            const initialBalance = await ethers.provider.getBalance(auditor1.address);
            await taskMarketplace.connect(auditor1).withdrawPayment(taskId);
            const finalBalance = await ethers.provider.getBalance(auditor1.address);
            const expectedReward = (reward * 10n) / 100n; // 10%
            expect(finalBalance - initialBalance).to.be.closeTo(expectedReward, ethers.parseEther("0.01"));
        });
        it("Should emit AuditorPaid event when auditor withdraws", async function () {
            await taskMarketplace.connect(auditor3).submitAuditVote(taskId, true);
            await expect(taskMarketplace.connect(auditor1).withdrawPayment(taskId))
                .to.emit(escrow, "AuditorPaid")
                .withArgs(auditor1.address, (reward * 10n) / 100n);
        });
        it("Should set hasWithdrawn to true when auditor withdraws", async function () {
            await taskMarketplace.connect(auditor3).submitAuditVote(taskId, true);
            await taskMarketplace.connect(auditor1).withdrawPayment(taskId);
            expect(await escrow.hasWithdrawn(auditor1.address)).to.be.true;
        });
        it("Should prevent double withdrawal", async function () {
            await taskMarketplace.connect(auditor3).submitAuditVote(taskId, true);
            await taskMarketplace.connect(auditor1).withdrawPayment(taskId);
            await expect(taskMarketplace.connect(auditor1).withdrawPayment(taskId))
                .to.be.revertedWith("Already withdrawn");
        });
        it("Should allow majority auditors, 2 of 3 to withdraw 1/2 of the 30% of the reward", async function () {
            await taskMarketplace.connect(auditor3).submitAuditVote(taskId, false);
            const initialBalance = await ethers.provider.getBalance(auditor1.address);
            await taskMarketplace.connect(auditor1).withdrawPayment(taskId);
            const finalBalance = await ethers.provider.getBalance(auditor1.address);
            const expectedReward = (reward * 15n) / 100n; // 15%
            expect(finalBalance - initialBalance).to.be.closeTo(
                expectedReward,
                ethers.parseEther("0.01")
            );
        });
        it("Should not allow minority auditors, 1 of 3 to withdraw", async function () {
            await taskMarketplace.connect(auditor3).submitAuditVote(taskId, false);
            await expect(taskMarketplace.connect(auditor3).withdrawPayment(taskId))
                .to.be.revertedWith("No reward eligible");
        });
        it("Should allow developer to withdraw 67% of the reward when work is disputed", async function () {
            await taskMarketplace.connect(auditor3).submitAuditVote(taskId, false);
            const initialBalance = await ethers.provider.getBalance(developer.address);
            await taskMarketplace.connect(developer).withdrawPayment(taskId);
            const finalBalance = await ethers.provider.getBalance(developer.address);
            const expectedReward = (reward * 67n) / 100n; // 67%
            expect(finalBalance - initialBalance).to.be.closeTo(
                expectedReward,
                ethers.parseEther("0.01")
            );
        });
    });

    describe("Provider Payment", function () {
        beforeEach(async function () {
            await taskMarketplace.connect(developer).applyForTaskAsDeveloper(taskId);
            await taskMarketplace.connect(provider).assignDeveloper(taskId, developer.address);
            for (const auditor of [auditor1, auditor2, auditor3]) {
                await taskMarketplace.connect(auditor).applyForTaskAsAuditor(taskId);
            }
            await taskMarketplace.connect(provider).startTask(taskId, { value: reward });
            const task = await taskMarketplace.tasks(taskId);
            escrow = await ethers.getContractAt("TaskEscrow", task.escrowAddress);
        });
        it("Should allow provider to refund 67% of the reward when winning dispute", async function () {
            const task = await taskMarketplace.tasks(taskId);
            escrow = await ethers.getContractAt("TaskEscrow", task.escrowAddress);
            await taskMarketplace.connect(developer).submitWork(taskId);
            await taskMarketplace.connect(provider).initiateDispute(taskId);
            await taskMarketplace.connect(auditor1).submitAuditVote(taskId, false);
            await taskMarketplace.connect(auditor2).submitAuditVote(taskId, false);
            await taskMarketplace.connect(auditor3).submitAuditVote(taskId, false);
            const initialBalance = await ethers.provider.getBalance(provider.address);
            await taskMarketplace.connect(provider).refundProvider(taskId);
            const finalBalance = await ethers.provider.getBalance(provider.address);
            const expectedAmount = reward - ((reward * 3n) / 100n) - ((reward * 30n) / 100n); // Total - platform fee - auditor rewards
            expect(finalBalance - initialBalance).to.be.closeTo(
                expectedAmount,
                ethers.parseEther("0.01")
            );
        });
        it("Should allow provider to refund 97% of the reward on cancellation", async function () {
            const snapshot = await ethers.provider.send("evm_snapshot", []);
            await ethers.provider.send("evm_increaseTime", [3601]);
            await ethers.provider.send("evm_mine");
            await taskMarketplace.connect(provider).checkDeadlineAndPenalize(taskId);
            const initialBalance = await ethers.provider.getBalance(provider.address);
            await taskMarketplace.connect(provider).refundProvider(taskId);
            const finalBalance = await ethers.provider.getBalance(provider.address);
            expect(finalBalance - initialBalance).to.be.closeTo((reward * 97n) / 100n,ethers.parseEther("0.01"));
            await ethers.provider.send("evm_revert", [snapshot]);
        });
        it("Should emit ProviderRefunded event when provider refunds", async function () {
            const snapshot = await ethers.provider.send("evm_snapshot", []);
            await ethers.provider.send("evm_increaseTime", [3601]);
            await ethers.provider.send("evm_mine");
            await taskMarketplace.connect(provider).checkDeadlineAndPenalize(taskId);
            await expect(taskMarketplace.connect(provider).refundProvider(taskId))
                .to.emit(escrow, "ProviderRefunded")
                .withArgs(provider.address, reward * 97n / 100n);
            await ethers.provider.send("evm_revert", [snapshot]);
        });
        it("Should set hasWithdrawn to true when provider refunds", async function () {
            const snapshot = await ethers.provider.send("evm_snapshot", []);
            await ethers.provider.send("evm_increaseTime", [3601]);
            await ethers.provider.send("evm_mine");
            await taskMarketplace.connect(provider).checkDeadlineAndPenalize(taskId);
            await taskMarketplace.connect(provider).refundProvider(taskId);
            expect(await escrow.hasWithdrawn(provider.address)).to.be.true;
            await ethers.provider.send("evm_revert", [snapshot]);
        });
        it("Should prevent double refund", async function () {
            const snapshot = await ethers.provider.send("evm_snapshot", []);
            await ethers.provider.send("evm_increaseTime", [3601]);
            await ethers.provider.send("evm_mine");
            await taskMarketplace.connect(provider).checkDeadlineAndPenalize(taskId);
            await taskMarketplace.connect(provider).refundProvider(taskId);
            await expect(taskMarketplace.connect(provider).refundProvider(taskId))
                .to.be.revertedWith("Already refunded");
            await ethers.provider.send("evm_revert", [snapshot]);
        });
    });

    describe("Balance Check", function () {
        it("Should return correct contract balance", async function () {
            expect(await escrow.getBalance()).to.equal((reward * 97n) / 100n,ethers.parseEther("0.01"));
        });
    });
}); 