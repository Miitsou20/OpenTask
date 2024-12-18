const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Treasury", function () {
    beforeEach(async function () {
        [owner, other] = await ethers.getSigners();
        const Treasury = await ethers.getContractFactory("Treasury");
        treasury = await Treasury.deploy();
    });
    
    describe("Receiving Funds", function () {
        const amount = ethers.parseEther("1.0");
        
        it("Should update all state variables correctly when receiving funds", async function () {
            await expect(owner.sendTransaction({to: treasury.target, value: amount}))
                .to.emit(treasury, "FundsReceived")
                .withArgs(owner.address, amount, amount);
            
            expect(await treasury.totalReceived()).to.equal(amount);
            expect(await treasury.totalReceivedByAddress(owner.address)).to.equal(amount);
        });
        
        it("Should track multiple deposits correctly", async function () {
            await owner.sendTransaction({ to: treasury.target, value: amount });
            await other.sendTransaction({ to: treasury.target, value: amount });
            
            expect(await treasury.totalReceived()).to.equal(amount * BigInt(2));
            expect(await treasury.totalReceivedByAddress(owner.address)).to.equal(amount);
            expect(await treasury.totalReceivedByAddress(other.address)).to.equal(amount);
        });
    });
    
    describe("Withdrawing Funds", function () {
        const depositAmount = ethers.parseEther("2.0");
        const withdrawAmount = ethers.parseEther("1.0");
        
        beforeEach(async function () {
            await owner.sendTransaction({to: treasury.target, value: depositAmount});
        });
        it("Should update all state variables correctly when withdrawing", async function () {
            await expect(treasury.withdraw(withdrawAmount)).to.emit(treasury, "FundsWithdrawn")
                .withArgs(owner.address, withdrawAmount, depositAmount - withdrawAmount, withdrawAmount);
            
            expect(await treasury.totalWithdrawn()).to.equal(withdrawAmount);
            expect(await treasury.totalWithdrawnByAddress(owner.address)).to.equal(withdrawAmount);
        });
        it("Should not allow withdrawal of 0 amount", async function () {
            await expect(treasury.withdraw(0)).to.be.revertedWith("Amount must be greater than 0");
        });
        it("Should not allow withdrawal more than balance", async function () {
            const tooMuch = ethers.parseEther("3.0");
            await expect(treasury.withdraw(tooMuch)).to.be.revertedWith("Insufficient balance");
        });
        it("Should not allow non-owner to withdraw", async function () {
            await expect(treasury.connect(other).withdraw(withdrawAmount))
                .to.be.reverted;
        });
        it("Should revert if transfer fails", async function () {
            const MockReceiver = await ethers.getContractFactory("MockReceiver");
            const mockReceiver = await MockReceiver.deploy();
            
            await treasury.transferOwnership(mockReceiver.target);
            
            await owner.sendTransaction({ to: treasury.target, value: withdrawAmount });
            
            await expect(mockReceiver.withdraw(treasury.target, withdrawAmount))
                .to.be.revertedWith("Withdrawal failed");
        });
    });
    
    describe("Transaction History", function () {
        const amount = ethers.parseEther("1.0");
        
        it("Should track transaction history correctly", async function () {
            await owner.sendTransaction({ to: treasury.target, value: amount });
            await treasury.withdraw(amount / BigInt(2));
            
            const [received, withdrawn, balance] = await treasury.getTransactionHistory(owner.address);
            
            expect(received).to.equal(amount);
            expect(withdrawn).to.equal(amount / BigInt(2));
            expect(balance).to.equal(amount / BigInt(2));
        });
    });

    describe("Balance", function () {
        const amount = ethers.parseEther("1.0");

        it("Should return the correct balance", async function () {
            expect(await treasury.getBalance()).to.equal(0);
        });
        it("Should return the correct balance after a deposit", async function () {
            await owner.sendTransaction({to: treasury.target, value: amount});
            expect(await treasury.getBalance()).to.equal(amount);
        });
        it("Should return the correct balance after a withdrawal", async function () {
            await owner.sendTransaction({to: treasury.target, value: amount});
            await treasury.withdraw(amount);
            expect(await treasury.getBalance()).to.equal(0);
        });
    });
}); 
