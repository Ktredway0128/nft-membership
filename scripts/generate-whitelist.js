const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

// Add whatever addresses you want to whitelist
const whitelist = [
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Hardhat deployer #0
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Hardhat account #1
];

const leaves = whitelist.map(addr => keccak256(addr));
const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
const root = tree.getHexRoot();

console.log("\n--- MERKLE WHITELIST ---");
console.log("Root:", root);
console.log("\n--- PROOFS ---");

whitelist.forEach(addr => {
  const proof = tree.getHexProof(keccak256(addr));
  console.log(`\nAddress: ${addr}`);
  console.log("Proof:", JSON.stringify(proof));
});