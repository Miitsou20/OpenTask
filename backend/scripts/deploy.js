const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Network:", hre.network.name);

  // 1. Deploy Treasury
  const Treasury = await hre.ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy();
  await treasury.waitForDeployment();
  console.log("Treasury deployed to:", await treasury.getAddress());

  // 2. Deploy SoulBoundTokenRole
  const SoulBoundTokenRole = await hre.ethers.getContractFactory("SoulBoundTokenRole");
  const sbtRole = await SoulBoundTokenRole.deploy();
  await sbtRole.waitForDeployment();
  console.log("SoulBoundTokenRole deployed to:", await sbtRole.getAddress());

  // 3. Deploy SoulBoundAchievement
  const SoulBoundAchievement = await hre.ethers.getContractFactory("SoulBoundAchievement");
  const sbtAchievement = await SoulBoundAchievement.deploy();
  await sbtAchievement.waitForDeployment();
  console.log("SoulBoundAchievement deployed to:", await sbtAchievement.getAddress());

  // 4. Deploy TaskMarketplace
  const TaskMarketplace = await hre.ethers.getContractFactory("TaskMarketplace");
  console.log("Deploying TaskMarketplace with SBT Role:", await sbtRole.getAddress());
  console.log("Deploying TaskMarketplace with SBT Achievement:", await sbtAchievement.getAddress());
  console.log("Deploying TaskMarketplace with Treasury:", await treasury.getAddress());
  
  const marketplace = await TaskMarketplace.deploy(
    await sbtRole.getAddress(),
    await sbtAchievement.getAddress(),
    await treasury.getAddress()
  );
  await marketplace.waitForDeployment();
  console.log("TaskMarketplace deployed to:", await marketplace.getAddress());

  // 5. Transfer ownership of SBT contracts to TaskMarketplace
  console.log("\nTransferring ownership of SBT contracts to TaskMarketplace...");
  await sbtRole.transferOwnership(await marketplace.getAddress());
  await sbtAchievement.transferOwnership(await marketplace.getAddress());
  console.log("Ownership transferred successfully");

  // 6. Post-deployment verifications
  console.log("\nVerifying deployments...");
  
  const marketplaceAddress = await marketplace.getAddress();
  const sbtRoleOwner = await sbtRole.owner();
  const sbtAchievementOwner = await sbtAchievement.owner();

  console.log("SBT Role owner:", sbtRoleOwner);
  console.log("SBT Achievement owner:", sbtAchievementOwner);
  console.log("Expected owner:", marketplaceAddress);

  if (sbtRoleOwner !== marketplaceAddress || sbtAchievementOwner !== marketplaceAddress) {
    console.error("❌ Error: Ownership was not properly transferred");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error during deployment:", error);
    process.exit(1);
  });

// npx hardhat run scripts/deploy.js --network <network_name>
