# NFT MEMBERSHIP CONTRACT

[![Verified on Etherscan](https://img.shields.io/badge/Etherscan-Verified-brightgreen)](https://sepolia.etherscan.io/address/0xF12215b2156f0E1dB8039d78FBad734b8f2158ac#code)

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Solidity](https://img.shields.io/badge/Solidity-0.8.19-blue)
![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-yellow)

Built by [Tredway Development](https://tredwaydev.com) — professional Solidity smart contract packages for Web3 companies.

A secure and production-ready NFT membership pass system built with Solidity, OpenZeppelin ERC-721, and Hardhat.

> ⚠️ This contract has not been professionally audited. A full security audit is strongly recommended before any mainnet deployment.


This project demonstrates a complete NFT membership pass system including:

Smart contract development
Automated testing
Deployment scripting
Phased minting with whitelist and public mint
Merkle tree whitelist verification
Role-based administrative permissions
Security best practices

This repository represents an optional add-on package in a Web3 infrastructure suite, complementing the ERC-20 Token Launch, Token Vesting, Merkle Airdrop, Token Staking, Token Crowdsale, and Token Governance contracts to complete a full token ecosystem.


## PROJECT GOALS

The purpose of this project is to demonstrate how a modern on-chain membership pass system should be designed for real-world use.

The system includes common features required by token membership protocols:

Phased minting with admin-controlled phase advancement
Merkle tree whitelist for gas-efficient early access verification
Configurable max supply and mint pricing
IPFS-based token metadata for membership card imagery
Role-based administrative permissions
Emergency pause and unpause controls
ERC-20 recovery for accidentally sent tokens

These patterns are widely used in production NFT and membership applications.


## SMART CONTRACT FEATURES

### NFT MEMBERSHIP

OPENZEPPELIN ERC-721 FRAMEWORK

The contract is built on the OpenZeppelin ERC-721 framework — the industry standard
for non-fungible tokens used across thousands of production NFT projects.
This provides a battle-tested foundation with well-audited security properties.

PHASED MINTING

The contract uses a three-phase minting system controlled by the admin.
Phases advance forward only — once public minting opens it cannot revert to whitelist.

PHASE        DESCRIPTION

Paused       Default state — no minting allowed
Whitelist    Only Merkle-verified addresses can mint at the whitelist price
Public       Open minting for any address at the public price

MERKLE WHITELIST

The whitelist uses a Merkle tree for gas-efficient verification.
Only addresses included in the Merkle tree can mint during the whitelist phase.
Each whitelisted address is limited to one whitelist mint.
The Merkle root is configurable by the admin before the whitelist phase opens.
Use the included generate-whitelist.js script to generate the root and verify proofs from any address list.

MINT PRICING

Two separate mint prices are configurable at deployment and updatable by the admin.
The whitelist mint price is typically set lower than the public mint price
to reward early community members and investors.
Overpayment is accepted — the contract collects the full msg.value sent.

MAX SUPPLY

A hard cap on total passes is set at deployment and enforced on every mint.
Once max supply is reached no further minting is possible regardless of phase.

IPFS METADATA

Each membership pass points to metadata stored on IPFS.
The base URI is configurable by the admin to support metadata updates or reveals.
Token URIs follow the standard baseURI + tokenId pattern.

ROLE-BASED PERMISSIONS

The contract uses OpenZeppelin AccessControl for role management.
Roles include:

ROLE                  DESCRIPTION

DEFAULT_ADMIN_ROLE    Full administrative control — cannot be renounced
ADMIN_ROLE            Phase management, config updates, pause, withdraw

ERC-20 RECOVERY

If ERC-20 tokens are accidentally sent to the contract address the admin
can recover them using the recoverERC20 function.
This function is limited to ERC-20 tokens only — membership passes
held by the contract cannot be recovered through this function.

EVENT TRACKING

The contract emits events for all important actions:

PassMinted, PassBurned, PhaseAdvanced, MerkleRootUpdated,
MintPriceUpdated, WhitelistMintPriceUpdated, BaseURIUpdated,
Withdrawn, ERC20Recovered


## TECHNOLOGY STACK

This project was built using the following tools:

Solidity – Smart contract programming language

Hardhat – Ethereum development environment

Ethers.js – Contract interaction library

OpenZeppelin Contracts – Secure smart contract libraries

Mocha & Chai – JavaScript testing framework

MerkleTreeJS – Merkle tree construction for whitelist verification

keccak256 – Leaf hashing for Merkle verification

Alchemy – Ethereum RPC provider

Sepolia Test Network – Deployment environment


## PROJECT STRUCTURE

contracts/
    NftMembership.sol
    MockERC20.sol

scripts/
    deploy-nft.js
    generate-whitelist.js
    deploy-mock-erc20.js

test/
    NftMembership.test.js

hardhat.config.js
.env

CONTRACTS

Contains the NftMembership ERC-721 contract and a MockERC20 used for testing ERC-20 recovery.

SCRIPTS

deploy-nft.js — deploys the NftMembership contract with configured parameters.
generate-whitelist.js — generates the Merkle root and per-address proofs from a whitelist array. Run this script whenever the whitelist changes and update the on-chain root via the admin panel or dashboard.
deploy-mock-erc20.js — deploys a mock ERC-20 and sends tokens to the NFT contract for testing the recover function.

TESTS

Contains 40 automated tests verifying all major contract behaviors including
phased minting, whitelist verification, access control, and edge cases.


## SMART CONTRACT ARCHITECTURE

The NftMembership contract extends the following OpenZeppelin modules:

ERC721, ERC721Burnable, ERC721Pausable, AccessControl

Whitelist verification uses the OpenZeppelin MerkleProof library.

Key configuration parameters:

maxSupply             – Maximum number of passes that can ever be minted
mintPrice             – ETH price per pass during public mint
whitelistMintPrice    – ETH price per pass during whitelist mint
baseURI               – IPFS URI pointing to membership card metadata
merkleRoot            – Root of the Merkle tree for whitelist verification


## INSTALLATION

### CLONE THE REPOSITORY:

git clone https://github.com/Ktredway0128/nft-membership

cd nft-membership

### INSTALL DEPENDENCIES:

npm install

### COMPILE THE CONTRACTS:

npx hardhat compile

### RUN THE TEST SUITE:

npx hardhat test

### THE TESTS VALIDATE:

Phased minting and phase advancement
Merkle whitelist verification and proof validation
Public mint access and supply enforcement
Pause and unpause controls
Token burning and transfers
ETH withdrawal
Admin configuration updates
ERC-20 recovery
Edge cases including overpayment, cross-address proofs, and operator transfers


## ENVIRONMENT SETUP

Create a .env file in the root directory.

ALCHEMY_API_URL=YOUR_SEPOLIA_RPC_URL

DEPLOYER_PRIVATE_KEY=YOUR_PRIVATE_KEY

ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY

These values allow Hardhat to:

Connect to the Sepolia network
Sign transactions using the deployer's wallet


## DEPLOYMENT

### STEP 1 - Generate your whitelist:

node scripts/generate-whitelist.js

Add your client addresses to the whitelist array in the script.
The script logs the Merkle root and a proof for each address.
Save the root — you will need it for deployment and the admin panel.

### STEP 2 - Deploy the contract:

npx hardhat run scripts/deploy-nft.js --network sepolia

The deployment script deploys NftMembership with your configured name, symbol,
max supply, mint prices, base URI, and initial Merkle root.

### STEP 3 - Set the Merkle root:

Before opening the whitelist phase generate your Merkle tree from the whitelist addresses
and call setMerkleRoot with the root hash. If using the dashboard this is handled
automatically from the whitelist.json file in the frontend.

### STEP 4 - Open whitelist minting:

Call advancePhase to move from Paused to Whitelist.
Whitelisted addresses can now mint at the whitelist price.

### STEP 5 - Open public minting:

Call advancePhase again to move from Whitelist to Public.
Any address can now mint at the public price until max supply is reached.

### STEP 6 - Withdraw collected ETH:

Call withdraw with the recipient address to collect all ETH from mints.

### SEPOLIA TESTNET DEPLOYMENT

| Contract | Address | Etherscan |
|----------|---------|-----------|
| NftMembership | 0xF12215b2156f0E1dB8039d78FBad734b8f2158ac | View on Etherscan | (https://sepolia.etherscan.io/address/0xF12215b2156f0E1dB8039d78FBad734b8f2158ac#code)


Deployed: 4-14-2026


## EXAMPLE CONFIGURATION

Token Name: Membership Pass
Token Symbol: PASS
Max Supply: 100
Public Mint Price: 0.05 ETH
Whitelist Mint Price: 0.03 ETH
Base URI: ipfs://YOUR_CID_HERE/


## DESIGN DECISIONS

ERC-721 STANDARD

Standard OpenZeppelin ERC-721 was chosen over proxy or upgradeable patterns
for the freelance suite. This keeps the contract simple, auditable, and gas efficient.
Clients who require upgradeability can request a custom proxy deployment.

MERKLE WHITELIST

A Merkle tree was chosen over a simple mapping for whitelist verification
because it is significantly more gas efficient at scale.
Adding thousands of addresses to an on-chain mapping requires thousands of transactions.
A Merkle tree only requires storing a single 32-byte root on-chain regardless of list size.
The generate-whitelist.js script handles all Merkle tree construction off-chain.

FORWARD-ONLY PHASES

Phase advancement is intentionally one-directional.
Once the public phase opens it cannot revert to whitelist.
This prevents admin manipulation of mint access after launch
and builds community trust in the minting process.

NOT MARKETED AS AN NFT

This contract is marketed as a Token Membership Pass or On-Chain Access Credential
rather than an NFT. The focus is on utility and access rather than collectibility,
making it more approachable for non-crypto-native clients.


## SECURITY PRACTICES

The contract uses well-established patterns from OpenZeppelin including:

Battle-tested ERC-721 framework used across thousands of production projects
MerkleProof verification for gas-efficient and manipulation-resistant whitelisting
Role-based permissions with renounce protection on DEFAULT_ADMIN_ROLE
Pausable transfers for emergency response
Forward-only phase advancement to prevent admin manipulation

These are common practices used in production smart contracts.


## EXAMPLE USE CASES

This membership pass contract can support many types of projects:

Early investor credentials for token launches
Community membership passes for DAOs and protocols
On-chain access credentials for gated platforms
Protocol access passes for DeFi applications
Whitelist passes for future token sales or airdrops
Contributor badges for open source or DAO teams


## BUNDLE WITH THE FULL SUITE

This contract is available as a standalone deployment or as an add-on
to any tier in the Tredway Development infrastructure suite.

Standalone:      $800 - $1,000
Add-on to tier:  $600

For the full suite including Token, Crowdsale, Vesting, Airdrop, Staking,
Governance, and NFT Membership visit tredwaydev.com.


## FUTURE ENHANCEMENTS

Possible upgrades include:

Tiered membership passes — Gold, Silver, Bronze with different mint prices and supplies
Upgradeable proxy pattern for post-deployment improvements
NFT-gated staking rewards — bonus APY for pass holders
NFT-gated governance — require pass to participate in DAO voting
Cross-contract integration with the full ERC-20 suite


## AUTHOR

Kyle Tredway

Smart Contract Developer / Token Launch Specialist

License

MIT