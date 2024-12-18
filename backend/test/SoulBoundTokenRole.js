require("solidity-coverage");

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SoulBoundTokenRole", function () {

  const role = {
    TaskProvider: 0,
    TaskDeveloper: 1,
    TaskAuditor: 2
  }

  beforeEach(async function () {
    [owner, provider, developer, auditor] = await ethers.getSigners();
    const SoulBoundTokenRole = await ethers.getContractFactory("SoulBoundTokenRole");
    sbtContract = await SoulBoundTokenRole.deploy();
  });

  describe("Initial State", function () {
      it("Should initialize with correct state", async function () {
          expect(await sbtContract.MAX_SUPPLY()).to.equal(1000);
      });
      it("Should have the correct name", async function () {
        expect(await sbtContract.name()).to.equal("OpenTaskRole");
      });
      it("Should have the correct symbol", async function () {
        expect(await sbtContract.symbol()).to.equal("OTR");
      });
  });

  describe("Minting", function () {
    it("Should mint a token", async function () {
      await sbtContract.safeMint(owner.address, role.TaskProvider);
      expect(await sbtContract.balanceOf(owner.address)).to.equal(1);
    });
    it("Should not mint a token if the address already has a token", async function () {
      await sbtContract.safeMint(owner.address, role.TaskProvider);
      await expect(sbtContract.safeMint(owner.address, role.TaskProvider)).to.be.reverted;
    });
    it("Should increment the tokenId", async function () {
      await sbtContract.safeMint(owner.address, role.TaskProvider);
      const tokenIdCounter = await sbtContract.getTokenIdCounter();
      expect(tokenIdCounter).to.equal(2);
    });
    it("Should emit an event on minting", async function () {
      await expect(sbtContract.safeMint(owner.address, role.TaskProvider)).to.emit(sbtContract, "SBTMinted");
    });
    it("Should set the correct role", async function () {
      await sbtContract.safeMint(owner.address, role.TaskProvider);
      const sbtRole = await sbtContract.tokenRole(0);
      expect(sbtRole).to.equal(role.TaskProvider);
    });
    it("Should tell if an address has a token", async function () {
      await sbtContract.safeMint(owner.address, role.TaskProvider);
      expect(await sbtContract.hasToken(owner.address)).to.equal(true);
    });
    it("Should mint only by the owner", async function () {
      await expect(sbtContract.connect(provider).safeMint(provider.address, role.TaskProvider)).to.be.reverted;
    });
    it("Should not mint when max supply is reached", async function () {
      // Set tokenIdCounter to MAX_SUPPLY
      const maxSupply = await sbtContract.MAX_SUPPLY();
      for(let i = 1; i < maxSupply; i++) {
        await sbtContract.safeMint(ethers.Wallet.createRandom().address, role.TaskProvider);
      }
      // Try to mint one more
      await expect(sbtContract.safeMint(owner.address, role.TaskProvider))
        .to.be.revertedWith("Creation limit reached");
    });
  });

  describe("Get Role", function () {
    it("Should get the developer role", async function () {
      await sbtContract.connect(owner).safeMint(owner.address, role.TaskDeveloper);
      expect(await sbtContract.getRole(owner.address)).to.equal(role.TaskDeveloper);
    });
    it("Should get the provider role", async function () {
      await sbtContract.connect(owner).safeMint(owner.address, role.TaskProvider);
      expect(await sbtContract.getRole(owner.address)).to.equal(role.TaskProvider);
    });
    it("Should get the auditor role", async function () {
      await sbtContract.connect(owner).safeMint(owner.address, role.TaskAuditor);
      expect(await sbtContract.getRole(owner.address)).to.equal(role.TaskAuditor);
    });
    it("Should revert when address has no token", async function () {
      await expect(sbtContract.getRole(owner.address))
        .to.be.revertedWith("No SBT found for this address");
    });
  });

  describe("Get Token Id Counter", function () {
    it("Should get the token id counter", async function () {
      expect(await sbtContract.getTokenIdCounter()).to.equal(1);
    });
  });

  describe("Transfer Prevention", function () {
    it("Should not allow token transfers", async function () {
      await sbtContract.safeMint(owner.address, role.TaskProvider);
      await expect(sbtContract.connect(owner).transferFrom(owner.address, developer.address, 1))
        .to.be.revertedWith("Soulbound: Transfer not allowed");
    });
    it("Should prevent transfer from zero address", async function () {
      await sbtContract.safeMint(owner.address, role.TaskProvider);
      await expect(
        sbtContract.connect(owner).transferFrom(ethers.ZeroAddress, owner.address, 1)
      ).to.be.revertedWith("Soulbound: Transfer not allowed");
    });
  });
});
