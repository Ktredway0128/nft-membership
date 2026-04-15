const { ethers, network } = require("hardhat");

/**
 * Increase EVM time — local only.
 * On Sepolia this just logs a warning and does nothing.
 * @param {number} seconds — how far to jump forward
 */
async function increaseTime(seconds) {
  if (network.name === "hardhat" || network.name === "localhost") {
    await network.provider.send("evm_increaseTime", [seconds]);
    await network.provider.send("evm_mine");
    console.log(`⏩ Time advanced ${seconds}s (${(seconds / 86400).toFixed(1)} days)`);
  } else {
    console.warn(`⚠️  increaseTime called on ${network.name} — skipping, real time only`);
  }
}

/**
 * Convenience wrappers
 */
const DAY = 86400;
const WEEK = DAY * 7;
const MONTH = DAY * 30;

module.exports = { increaseTime, DAY, WEEK, MONTH };