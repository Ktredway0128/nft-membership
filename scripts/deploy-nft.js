const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contract with account:", deployer.address);

    const NftMembership = await hre.ethers.getContractFactory("NftMembership");

    const name = "Membership Pass";
    const symbol = "PASS";
    const maxSupply = 5;
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
    fs.writeFileSync("deployments/local.json", JSON.stringify(deployment, null, 2));
    console.log("Deployment saved to deployments/local.json");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});