const hre = require("hardhat");

async function deployAndLog(contractName, factory, ...args) {
  console.log(`\nDeploying ${contractName}...`);
  const contract = await factory.deploy(...args);
  const deployTx = contract.deploymentTransaction();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  
  const receipt = await deployTx.wait();
  const gasUsed = receipt.gasUsed;
  const gasPrice = deployTx.gasPrice;
  const costInEth = hre.ethers.formatEther(gasUsed * gasPrice);
  
  console.log(`${contractName} deployed to: ${address}`);
  console.log(`Gas used: ${gasUsed.toString()}`);
  console.log(`Cost: ${costInEth} ETH`);
  
  return { contract, gasUsed, costInEth };
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Network:", hre.network.name);

  let totalGasUsed = BigInt(0);
  let totalCostInEth = 0;

  // 1. Deploy Treasury
  const Treasury = await hre.ethers.getContractFactory("Treasury");
  const { contract: treasury, gasUsed: gas1, costInEth: cost1 } = await deployAndLog("Treasury", Treasury);
  totalGasUsed += gas1;
  totalCostInEth += parseFloat(cost1);

  // 2. Deploy SoulBoundTokenRole
  const SoulBoundTokenRole = await hre.ethers.getContractFactory("SoulBoundTokenRole");
  const { contract: sbtRole, gasUsed: gas2, costInEth: cost2 } = await deployAndLog("SoulBoundTokenRole", SoulBoundTokenRole);
  totalGasUsed += gas2;
  totalCostInEth += parseFloat(cost2);

  // 3. Deploy SoulBoundAchievement
  const SoulBoundAchievement = await hre.ethers.getContractFactory("SoulBoundAchievement");
  const { contract: sbtAchievement, gasUsed: gas3, costInEth: cost3 } = await deployAndLog("SoulBoundAchievement", SoulBoundAchievement);
  totalGasUsed += gas3;
  totalCostInEth += parseFloat(cost3);

  // 4. Deploy SoulBoundRedflag
  const SoulBoundRedflag = await hre.ethers.getContractFactory("SoulBoundRedflag");
  const { contract: sbtRedflag, gasUsed: gas4, costInEth: cost4 } = await deployAndLog("SoulBoundRedflag", SoulBoundRedflag);
  totalGasUsed += gas4;
  totalCostInEth += parseFloat(cost4);

  // 5. Deploy TaskMarketplace
  const TaskMarketplace = await hre.ethers.getContractFactory("TaskMarketplace");
  console.log("\nDeploying TaskMarketplace with:");
  console.log("- SBT Role:", await sbtRole.getAddress());
  console.log("- SBT Achievement:", await sbtAchievement.getAddress());
  console.log("- SBT Redflag:", await sbtRedflag.getAddress());
  console.log("- Treasury:", await treasury.getAddress());
  
  const { contract: marketplace, gasUsed: gas5, costInEth: cost5 } = await deployAndLog(
    "TaskMarketplace",
    TaskMarketplace,
    await sbtRole.getAddress(),
    await sbtAchievement.getAddress(),
    await sbtRedflag.getAddress(),
    await treasury.getAddress()
  );
  totalGasUsed += gas5;
  totalCostInEth += parseFloat(cost5);

  // 6. Transfer ownership
  console.log("\nTransferring ownership of SBT contracts to TaskMarketplace...");
  const marketplaceAddress = await marketplace.getAddress();
  
  const txRole = await sbtRole.transferOwnership(marketplaceAddress);
  const txAchievement = await sbtAchievement.transferOwnership(marketplaceAddress);
  const txRedflag = await sbtRedflag.transferOwnership(marketplaceAddress);
  
  // Log ownership transfer gas costs
  const [receiptRole, receiptAchievement, receiptRedflag] = await Promise.all([
    txRole.wait(),
    txAchievement.wait(),
    txRedflag.wait()
  ]);
  
  console.log("Ownership transfer gas used:");
  console.log("- SBT Role:", receiptRole.gasUsed.toString());
  console.log("- SBT Achievement:", receiptAchievement.gasUsed.toString());
  console.log("- SBT Redflag:", receiptRedflag.gasUsed.toString());

  // Add ownership transfer costs to total
  totalGasUsed += receiptRole.gasUsed + receiptAchievement.gasUsed + receiptRedflag.gasUsed;
  const ownershipCostInEth = hre.ethers.formatEther(
    (receiptRole.gasUsed + receiptAchievement.gasUsed + receiptRedflag.gasUsed) * 
    txRole.gasPrice
  );
  totalCostInEth += parseFloat(ownershipCostInEth);

  // 7. Verify deployments
  console.log("\nVerifying deployments...");
  const sbtRoleOwner = await sbtRole.owner();
  const sbtAchievementOwner = await sbtAchievement.owner();
  const sbtRedflagOwner = await sbtRedflag.owner();
  
  console.log("SBT Role owner:", sbtRoleOwner);
  console.log("SBT Achievement owner:", sbtAchievementOwner);
  console.log("SBT Redflag owner:", sbtRedflagOwner);
  console.log("Expected owner:", marketplaceAddress);

  if (sbtRoleOwner !== marketplaceAddress || 
      sbtAchievementOwner !== marketplaceAddress || 
      sbtRedflagOwner !== marketplaceAddress) {
    console.error("❌ Error: Ownership was not properly transferred");
    process.exit(1);
  }

  // 8. Verify on Etherscan if not localhost
  if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
    console.log("\nVerifying contracts on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: await treasury.getAddress(),
        constructorArguments: [],
      });

      await hre.run("verify:verify", {
        address: await sbtRole.getAddress(),
        constructorArguments: [],
      });

      await hre.run("verify:verify", {
        address: await sbtAchievement.getAddress(),
        constructorArguments: [],
      });

      await hre.run("verify:verify", {
        address: await sbtRedflag.getAddress(),
        constructorArguments: [],
      });

      await hre.run("verify:verify", {
        address: await marketplace.getAddress(),
        constructorArguments: [
          await sbtRole.getAddress(),
          await sbtAchievement.getAddress(),
          await sbtRedflag.getAddress(),
          await treasury.getAddress(),
        ],
      });
    } catch (error) {
      console.error("Error verifying contracts:", error);
    }
  }

  // 9. Log deployment summary
  console.log("\n📊 Deployment Summary");
  console.log("====================");
  console.log(`Total Gas Used: ${totalGasUsed.toString()}`);
  console.log(`Total Cost: ${totalCostInEth.toFixed(6)} ETH`);
  
  // Ajouter le coût en USD si possible
  try {
    const ethPrice = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
      .then(res => res.json())
      .then(data => data.ethereum.usd);
    console.log(`Total Cost in USD: $${(totalCostInEth * ethPrice).toFixed(2)} (ETH price: $${ethPrice})`);
  } catch (error) {
    console.log("Could not fetch ETH price");
  }
  
  console.log("\nDeployment completed! 🎉");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error during deployment:", error);
    process.exit(1);
  });

// npx hardhat run scripts/deploy.js --network <network_name>
// slither . --print human-summary
// npx hardhat test
