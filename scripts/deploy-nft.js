const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contract with account:", deployer.address);

    const NftMembership = await hre.ethers.getContractFactory("NftMembership");

    const name = "Membership Pass";
    const symbol = "PASS";
    const maxSupply = 100;
    const mintPrice = hre.ethers.utils.parseEther("0.05");
    const whitelistMintPrice = hre.ethers.utils.parseEther("0.03");
    const baseURI = "ipfs://YOUR_CID_HERE/";
    const merkleRoot = hre.ethers.constants.HashZero;

    const nft = await NftMembership.deploy(
        name,
        symbol,
        maxSupply,
        mintPrice,
        whitelistMintPrice,
        baseURI,
        merkleRoot
    );
    await nft.deployed();

    console.log("NftMembership deployed to:", nft.address);

    // Save deployment address
    const fs = require("fs");
    const deployment = { NftMembership: nft.address };
    fs.writeFileSync("deployments/sepolia.json", JSON.stringify(deployment, null, 2));
    console.log("Deployment saved to deployments/sepolia.json");

    // Wait for block confirmations before verifying
    console.log("Waiting for block confirmations...");
    await nft.deployTransaction.wait(5);

    // Verify on Etherscan
    console.log("Verifying contract on Etherscan...");
    await hre.run("verify:verify", {
        address: nft.address,
        constructorArguments: [
            name,
            symbol,
            maxSupply,
            mintPrice,
            whitelistMintPrice,
            baseURI,
            merkleRoot,
        ],
    });

    console.log("Contract verified!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});