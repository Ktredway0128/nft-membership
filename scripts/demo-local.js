const hre = require("hardhat");
const { ethers } = hre;
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");
const { increaseTime, DAY } = require("./utils/time");

async function main() {
  const [deployer, whitelistUser, publicUser] = await ethers.getSigners();
  console.log("\n=== NFT MEMBERSHIP — LOCAL LIFECYCLE DEMO ===\n");

  // In demo-local.js, replace the tree build section with this
  const whitelist = [deployer.address, whitelistUser.address]; // mirrors your generate-whitelist pattern
  const leaves = whitelist.map((addr) => keccak256(addr));
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const merkleRoot = "0x" + tree.getRoot().toString("hex");
  console.log("Merkle root:", merkleRoot);

  // ── 2. Deploy ────────────────────────────────────────────────────────────
  const NftMembership = await ethers.getContractFactory("NftMembership");
  const mintPrice = ethers.utils.parseEther("0.05");
  const whitelistMintPrice = ethers.utils.parseEther("0.03");

  const nft = await NftMembership.deploy(
    "Membership Pass",
    "PASS",
    100,
    mintPrice,
    whitelistMintPrice,
    "ipfs://YOUR_CID_HERE/",
    merkleRoot
  );
  await nft.deployed();
  console.log("Deployed to:", nft.address);
  console.log("Phase:", await nft.currentPhase()); // 0 = Paused

  // ── 3. Advance to Whitelist phase ────────────────────────────────────────
  await increaseTime(DAY);
  await nft.advancePhase();
  console.log("\nPhase advanced → Whitelist (1)");

  // ── 4. Whitelist mint ────────────────────────────────────────────────────
  const leaf = keccak256(whitelistUser.address);
  const proof = tree.getHexProof(leaf);

  await nft.connect(whitelistUser).whitelistMint(proof, {
    value: whitelistMintPrice,
  });
  console.log("Whitelist mint by:", whitelistUser.address);
  console.log("Total minted:", (await nft.totalMinted()).toString());

  // ── 5. Advance to Public phase ───────────────────────────────────────────
  await increaseTime(DAY * 3);
  await nft.advancePhase();
  console.log("\nPhase advanced → Public (2)");

  // ── 6. Public mint ───────────────────────────────────────────────────────
  await nft.connect(publicUser).publicMint({ value: mintPrice });
  console.log("Public mint by:", publicUser.address);
  console.log("Total minted:", (await nft.totalMinted()).toString());

  // ── 7. Withdraw ──────────────────────────────────────────────────────────
  await increaseTime(DAY);
  const balanceBefore = await ethers.provider.getBalance(deployer.address);
  await nft.withdraw(deployer.address);
  const balanceAfter = await ethers.provider.getBalance(deployer.address);
  console.log("\nWithdraw complete");
  console.log("ETH recovered:", ethers.utils.formatEther(balanceAfter.sub(balanceBefore)));

  console.log("\n=== DEMO COMPLETE ===");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});