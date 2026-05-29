async function main() {
  const PredictionProof = await ethers.getContractFactory("PredictionProof");
  const contract = await PredictionProof.deploy();

  await contract.waitForDeployment();

  const address = await contract.getAddress();

  console.log("PredictionProof deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});