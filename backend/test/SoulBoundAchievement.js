require("solidity-coverage");

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SoulBoundAchievement", function () {
  const achievementType = {
    FIVE_TASKS: 0,
    TEN_TASKS: 1,
    FIFTY_TASKS: 2,
    HUNDRED_TASKS: 3
  }

  beforeEach(async function () {
    [owner, developer1, developer2] = await ethers.getSigners();
    const SoulBoundAchievement = await ethers.getContractFactory("SoulBoundAchievement");
    achievementContract = await SoulBoundAchievement.deploy();
  });

  describe("Initial State", function () {
    it("Should have the correct name", async function () {
      expect(await achievementContract.name()).to.equal("DeveloperAchievement");
    });
    it("Should have the correct symbol", async function () {
      expect(await achievementContract.symbol()).to.equal("DACH");
    });
    it("Should initialize with zero completed tasks", async function () {
      expect(await achievementContract.getCompletedTasks(developer1.address)).to.equal(0);
    });
  });

  describe("Task Completion", function () {
    it("Should increment completed tasks counter", async function () {
      await achievementContract.taskCompleted(developer1.address);
      expect(await achievementContract.getCompletedTasks(developer1.address)).to.equal(1);
    });
    it("Should emit TaskCompleted event", async function () {
      await expect(achievementContract.taskCompleted(developer1.address))
        .to.emit(achievementContract, "TaskCompleted")
        .withArgs(developer1.address, 1);
    });
    it("Should only be called by owner", async function () {
      await expect(achievementContract.connect(developer1).taskCompleted(developer1.address)).to.be.reverted;
    });
  });

  describe("Achievement Minting", function () {
    it("Should mint FIVE_TASKS achievement at 5 tasks", async function () {
      for(let i = 0; i < 5; i++) {
        await achievementContract.taskCompleted(developer1.address);
      }
      expect(await achievementContract.hasAchievement(developer1.address, achievementType.FIVE_TASKS))
        .to.equal(true);
    });

    it("Should mint TEN_TASKS achievement at 10 tasks", async function () {
      for(let i = 0; i < 10; i++) {
        await achievementContract.taskCompleted(developer1.address);
      }
      expect(await achievementContract.hasAchievement(developer1.address, achievementType.TEN_TASKS))
        .to.equal(true);
    });

    it("Should emit AchievementMinted event", async function () {
      for(let i = 0; i < 4; i++) {
        await achievementContract.taskCompleted(developer1.address);
      }
      await expect(achievementContract.taskCompleted(developer1.address))
        .to.emit(achievementContract, "AchievementMinted");
    });

    it("Should not mint same achievement twice", async function () {
      for(let i = 0; i < 10; i++) {
        await achievementContract.taskCompleted(developer1.address);
      }
      expect(await achievementContract.balanceOf(developer1.address)).to.equal(3);
    });
  });

  describe("Transfer Prevention", function () {
    it("Should not allow token transfers", async function () {
      for(let i = 0; i < 5; i++) {
        await achievementContract.taskCompleted(developer1.address);
      }
      await expect(achievementContract.transferFrom(developer1.address, developer2.address, 1))
        .to.be.revertedWith("SoulBound: Transfer not allowed");
    });
  });

  describe("Next Achievement Threshold", function () {
    it("Should return correct next threshold for new developer", async function () {
      expect(await achievementContract.getNextAchievementThreshold(developer1.address)).to.equal(1);
    });

    it("Should return correct next threshold after some tasks", async function () {
      for(let i = 0; i < 7; i++) {
        await achievementContract.taskCompleted(developer1.address);
      }
      expect(await achievementContract.getNextAchievementThreshold(developer1.address))
        .to.equal(10);
    });

    it("Should return 0 when all achievements are unlocked", async function () {
      for(let i = 0; i < 100; i++) {
        await achievementContract.taskCompleted(developer1.address);
      }
      expect(await achievementContract.getNextAchievementThreshold(developer1.address))
        .to.equal(0);
    });
  });
});
