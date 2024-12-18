require("solidity-coverage");

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SoulBoundRedflag", function () {
    beforeEach(async function () {
        [owner, developer1, developer2] = await ethers.getSigners();
        const SoulBoundRedflag = await ethers.getContractFactory("SoulBoundRedflag");
        redflagContract = await SoulBoundRedflag.deploy();
    });

    describe("Initial State", function () {
        it("Should have the correct name", async function () {
            expect(await redflagContract.name()).to.equal("DeveloperRedflag");
        });

        it("Should have the correct symbol", async function () {
            expect(await redflagContract.symbol()).to.equal("DREF");
        });

        it("Should initialize with zero disputes", async function () {
            const [dates, total] = await redflagContract.getDisputeHistory(developer1.address);
            expect(total).to.equal(0);
            expect(dates.length).to.equal(0);
        });
    });

    describe("Dispute Recording", function () {
        it("Should record a lost dispute", async function () {
            await redflagContract.recordLostDispute(developer1.address);
            const [dates, total] = await redflagContract.getDisputeHistory(developer1.address);
            expect(total).to.equal(1);
            expect(dates.length).to.equal(1);
        });
        it("Should emit DisputeLost event with correct timestamp", async function () {
            const tx = await redflagContract.recordLostDispute(developer1.address);
            const block = await ethers.provider.getBlock(tx.blockNumber);
            await expect(tx)
                .to.emit(redflagContract, "DisputeLost")
                .withArgs(developer1.address, block.timestamp);
        });
        it("Should only be called by owner", async function () {
            await expect(redflagContract.connect(developer1).recordLostDispute(developer1.address)).to.be.reverted;
        });
        it("Should track multiple disputes for the same developer", async function () {
            await redflagContract.recordLostDispute(developer1.address);
            await redflagContract.recordLostDispute(developer1.address);
            const [dates, total] = await redflagContract.getDisputeHistory(developer1.address);
            expect(total).to.equal(2);
            expect(dates.length).to.equal(2);
        });
    });

    describe("Redflag Minting", function () {
        it("Should mint redflag after three disputes", async function () {
            for(let i = 0; i < 3; i++) {
                await redflagContract.recordLostDispute(developer1.address);
            }
            expect(await redflagContract.balanceOf(developer1.address)).to.equal(1);
        });
        it("Should emit RedflagMinted event with correct data", async function () {
            for(let i = 0; i < 2; i++) {
                await redflagContract.recordLostDispute(developer1.address);
            }
            const tx = await redflagContract.recordLostDispute(developer1.address);
            const block = await ethers.provider.getBlock(tx.blockNumber);
            await expect(tx)
                .to.emit(redflagContract, "RedflagMinted")
                .withArgs(developer1.address, 1, block.timestamp);
        });
        it("Should not mint multiple redflags for the same developer", async function () {
            for(let i = 0; i < 5; i++) {
                await redflagContract.recordLostDispute(developer1.address);
            }
            expect(await redflagContract.balanceOf(developer1.address)).to.equal(1);
        });
        it("Should correctly map token to developer", async function () {
            for(let i = 0; i < 3; i++) {
                await redflagContract.recordLostDispute(developer1.address);
            }
            expect(await redflagContract.tokenToDeveloper(1)).to.equal(developer1.address);
        });
    });

    describe("Transfer Prevention", function () {
        it("Should not allow token transfers", async function () {
            for(let i = 0; i < 3; i++) {
                await redflagContract.recordLostDispute(developer1.address);
            }
            await expect(redflagContract.transferFrom(developer1.address, developer2.address, 1)).to.be.revertedWith("SoulBound: Transfer not allowed");
        });
    });

    describe("Dispute History", function () {
        it("Should return correct dispute history", async function () {
            const timestamps = [];
            for(let i = 0; i < 3; i++) {
                await redflagContract.recordLostDispute(developer1.address);
                const block = await ethers.provider.getBlock('latest');
                timestamps.push(block.timestamp);
            }
            
            const [dates, total] = await redflagContract.getDisputeHistory(developer1.address);
            expect(total).to.equal(3);
            expect(dates.length).to.equal(3);
        });
        it("Should return empty history for new developer", async function () {
            const [dates, total] = await redflagContract.getDisputeHistory(developer2.address);
            expect(total).to.equal(0);
            expect(dates.length).to.equal(0);
        });
    });

    describe("Redflag Status", function () {
        it("Should correctly identify developers with redflags", async function () {
            for(let i = 0; i < 3; i++) {
                await redflagContract.recordLostDispute(developer1.address);
            }
            const [, total] = await redflagContract.getDisputeHistory(developer1.address);
            expect(total).to.be.gte(3);
            expect(await redflagContract.balanceOf(developer1.address)).to.equal(1);
        });
    });
});