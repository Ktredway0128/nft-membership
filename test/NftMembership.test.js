const { expect }             = require("chai");
const { ethers }             = require("hardhat");

describe("NftMembership", function () {
  let NftMembership,
      nft,
      owner,
      addr1,
      addr2,
      merkleRoot,
      merkleProof,
      tree;

  // Merkle tree helpers
  const { MerkleTree } = require("merkletreejs");
  const keccak256 = require("keccak256");

  function buildTree(addresses) {
    const leaves = addresses.map(a => keccak256(a));
    return new MerkleTree(leaves, keccak256, { sortPairs: true });
  }

  function getProof(t, address) {
    return t.getHexProof(keccak256(address));
  }

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    // Build merkle tree with both addr1 AND addr2 so proofs are meaningful
    tree = buildTree([addr1.address, addr2.address]);
    merkleRoot = tree.getHexRoot();
    merkleProof = getProof(tree, addr1.address);

    NftMembership = await ethers.getContractFactory("NftMembership");
    nft = await NftMembership.deploy(
      "Membership Pass",
      "PASS",
      1000,
      ethers.utils.parseEther("0.05"),
      ethers.utils.parseEther("0.03"),
      "ipfs://TEST_CID/",
      merkleRoot
    );
    await nft.deployed();
  });

  it("should set the right name, symbol, maxSupply, and start in Paused phase", async function () {
    expect(await nft.name()).to.equal("Membership Pass");
    expect(await nft.symbol()).to.equal("PASS");
    expect((await nft.maxSupply()).toString()).to.equal("1000");
    expect(await nft.currentPhase()).to.equal(0); // Phase.Paused
    expect((await nft.totalMinted()).toString()).to.equal("0");

    console.log("NftMembership deployed and verified initial state");
  });

  // ─────────────────────────────────────────
  // Phase Management
  // ─────────────────────────────────────────

  describe("Phase Management", function () {
    it("Admin can advance from Paused to Whitelist", async function () {
      await expect(nft.connect(owner).advancePhase())
        .to.emit(nft, "PhaseAdvanced")
        .withArgs(1);

      expect(await nft.currentPhase()).to.equal(1);
      console.log("Phase advanced to Whitelist");
    });

    it("Admin can advance from Whitelist to Public", async function () {
      await nft.connect(owner).advancePhase();
      await expect(nft.connect(owner).advancePhase())
        .to.emit(nft, "PhaseAdvanced")
        .withArgs(2);

      expect(await nft.currentPhase()).to.equal(2);
      console.log("Phase advanced to Public");
    });

    it("Cannot advance past Public phase", async function () {
      await nft.connect(owner).advancePhase();
      await nft.connect(owner).advancePhase();

      await expect(nft.connect(owner).advancePhase())
        .to.be.revertedWith("Already at final phase");
    });

    it("Non-admin cannot advance phase", async function () {
      await expect(nft.connect(addr1).advancePhase())
        .to.be.revertedWith(
          `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${await nft.ADMIN_ROLE()}`
        );
    });
  });

  // ─────────────────────────────────────────
  // Whitelist Minting
  // ─────────────────────────────────────────

  describe("Whitelist Minting", function () {
    beforeEach(async function () {
      await nft.connect(owner).advancePhase();
    });

    it("Whitelisted address can mint with valid proof", async function () {
      await expect(
        nft.connect(addr1).whitelistMint(merkleProof, {
          value: ethers.utils.parseEther("0.03")
        })
      )
        .to.emit(nft, "PassMinted")
        .withArgs(addr1.address, 1);

      expect(await nft.totalMinted()).to.equal(1);
      expect(await nft.ownerOf(1)).to.equal(addr1.address);
      expect(await nft.whitelistClaimed(addr1.address)).to.equal(true);

      console.log("Whitelisted addr1 minted token #1");
    });

    it("Cannot whitelist mint with invalid proof", async function () {
      // Build a completely separate tree that the contract doesn't know about
      const badTree = buildTree([ethers.Wallet.createRandom().address]);
      const badProof = getProof(badTree, ethers.Wallet.createRandom().address);

      await expect(
        nft.connect(addr2).whitelistMint(badProof, {
          value: ethers.utils.parseEther("0.03")
        })
      ).to.be.revertedWith("Invalid Merkle proof");
    });

    it("Cannot whitelist mint twice", async function () {
      await nft.connect(addr1).whitelistMint(merkleProof, {
        value: ethers.utils.parseEther("0.03")
      });

      await expect(
        nft.connect(addr1).whitelistMint(merkleProof, {
          value: ethers.utils.parseEther("0.03")
        })
      ).to.be.revertedWith("Already claimed whitelist mint");
    });

    it("Cannot whitelist mint with insufficient payment", async function () {
      await expect(
        nft.connect(addr1).whitelistMint(merkleProof, {
          value: ethers.utils.parseEther("0.01")
        })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Cannot whitelist mint during wrong phase", async function () {
      await nft.connect(owner).advancePhase();

      await expect(
        nft.connect(addr1).whitelistMint(merkleProof, {
          value: ethers.utils.parseEther("0.03")
        })
      ).to.be.revertedWith("Whitelist phase not active");
    });
  });

  // ─────────────────────────────────────────
  // Public Minting
  // ─────────────────────────────────────────

  describe("Public Minting", function () {
    beforeEach(async function () {
      await nft.connect(owner).advancePhase();
      await nft.connect(owner).advancePhase();
    });

    it("Anyone can mint during public phase", async function () {
      await expect(
        nft.connect(addr2).publicMint({
          value: ethers.utils.parseEther("0.05")
        })
      )
        .to.emit(nft, "PassMinted")
        .withArgs(addr2.address, 1);

      expect(await nft.totalMinted()).to.equal(1);
      expect(await nft.ownerOf(1)).to.equal(addr2.address);

      console.log("addr2 minted token #1 during public phase");
    });

    it("Cannot public mint with insufficient payment", async function () {
      await expect(
        nft.connect(addr2).publicMint({
          value: ethers.utils.parseEther("0.01")
        })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Cannot public mint during wrong phase", async function () {
      const fresh = await NftMembership.deploy(
        "Membership Pass",
        "PASS",
        1000,
        ethers.utils.parseEther("0.05"),
        ethers.utils.parseEther("0.03"),
        "ipfs://TEST_CID/",
        merkleRoot
      );
      await fresh.deployed();

      await expect(
        fresh.connect(addr2).publicMint({
          value: ethers.utils.parseEther("0.05")
        })
      ).to.be.revertedWith("Public phase not active");
    });

    it("Cannot mint beyond max supply", async function () {
      const smallNft = await NftMembership.deploy(
        "Membership Pass",
        "PASS",
        1,
        ethers.utils.parseEther("0.05"),
        ethers.utils.parseEther("0.03"),
        "ipfs://TEST_CID/",
        merkleRoot
      );
      await smallNft.deployed();
      await smallNft.connect(owner).advancePhase();
      await smallNft.connect(owner).advancePhase();

      await smallNft.connect(addr1).publicMint({
        value: ethers.utils.parseEther("0.05")
      });

      await expect(
        smallNft.connect(addr2).publicMint({
          value: ethers.utils.parseEther("0.05")
        })
      ).to.be.revertedWith("Max supply reached");
    });
  });

  // ─────────────────────────────────────────
  // Pausing
  // ─────────────────────────────────────────

  describe("Pausing", function () {
    it("Admin can pause and minting is blocked", async function () {
      await nft.connect(owner).advancePhase();
      await nft.connect(owner).advancePhase();
      await nft.connect(owner).pause();

      await expect(
        nft.connect(addr2).publicMint({
          value: ethers.utils.parseEther("0.05")
        })
      ).to.be.revertedWith("Pausable: paused");

      console.log("Contract paused, minting blocked");
    });

    it("Admin can unpause and minting resumes", async function () {
      await nft.connect(owner).advancePhase();
      await nft.connect(owner).advancePhase();
      await nft.connect(owner).pause();
      await nft.connect(owner).unpause();

      await expect(
        nft.connect(addr2).publicMint({
          value: ethers.utils.parseEther("0.05")
        })
      ).to.not.be.reverted;

      console.log("Contract unpaused, minting resumed");
    });

    it("Non-admin cannot pause", async function () {
      await expect(nft.connect(addr1).pause())
        .to.be.revertedWith(
          `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${await nft.ADMIN_ROLE()}`
        );
    });
  });

  // ─────────────────────────────────────────
  // Burning
  // ─────────────────────────────────────────

  describe("Burning", function () {
    beforeEach(async function () {
      await nft.connect(owner).advancePhase();
      await nft.connect(owner).advancePhase();
      await nft.connect(addr1).publicMint({
        value: ethers.utils.parseEther("0.05")
      });
    });

    it("Token holder can burn their pass and emit PassBurned", async function () {
      await expect(nft.connect(addr1).burn(1))
        .to.emit(nft, "PassBurned")
        .withArgs(addr1.address, 1);

      console.log("addr1 burned token #1");
    });

    it("Non-owner cannot burn a pass", async function () {
      await expect(nft.connect(addr2).burn(1))
        .to.be.revertedWith("ERC721: caller is not token owner or approved");
    });
  });

  // ─────────────────────────────────────────
  // Withdraw
  // ─────────────────────────────────────────

  describe("Withdraw", function () {
    it("Admin can withdraw collected ETH", async function () {
      await nft.connect(owner).advancePhase();
      await nft.connect(owner).advancePhase();
      await nft.connect(addr1).publicMint({
        value: ethers.utils.parseEther("0.05")
      });

      const balanceBefore = await ethers.provider.getBalance(owner.address);

      await expect(nft.connect(owner).withdraw(owner.address))
        .to.emit(nft, "Withdrawn")
        .withArgs(owner.address, ethers.utils.parseEther("0.05"));

      const balanceAfter = await ethers.provider.getBalance(owner.address);
      expect(balanceAfter).to.be.gt(balanceBefore);

      console.log("Admin withdrew 0.05 ETH from contract");
    });

    it("Cannot withdraw when balance is zero", async function () {
      await expect(nft.connect(owner).withdraw(owner.address))
        .to.be.revertedWith("Nothing to withdraw");
    });

    it("Non-admin cannot withdraw", async function () {
      await expect(nft.connect(addr1).withdraw(addr1.address))
        .to.be.revertedWith(
          `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${await nft.ADMIN_ROLE()}`
        );
    });
  });

  // ─────────────────────────────────────────
  // Admin Config
  // ─────────────────────────────────────────

  describe("Admin Config", function () {
    it("Admin can update mint price", async function () {
      await expect(
        nft.connect(owner).setMintPrice(ethers.utils.parseEther("0.1"))
      )
        .to.emit(nft, "MintPriceUpdated")
        .withArgs(ethers.utils.parseEther("0.1"));

      expect(await nft.mintPrice()).to.equal(ethers.utils.parseEther("0.1"));
      console.log("Mint price updated to 0.1 ETH");
    });

    it("Admin can update whitelist mint price", async function () {
      await expect(
        nft.connect(owner).setWhitelistMintPrice(ethers.utils.parseEther("0.02"))
      )
        .to.emit(nft, "WhitelistMintPriceUpdated")
        .withArgs(ethers.utils.parseEther("0.02"));

      expect(await nft.whitelistMintPrice()).to.equal(
        ethers.utils.parseEther("0.02")
      );
    });

    it("Admin can update merkle root", async function () {
      const newTree = buildTree([addr2.address]);
      const newRoot = newTree.getHexRoot();

      await expect(nft.connect(owner).setMerkleRoot(newRoot))
        .to.emit(nft, "MerkleRootUpdated")
        .withArgs(newRoot);

      expect(await nft.merkleRoot()).to.equal(newRoot);
      console.log("Merkle root updated");
    });

    it("Admin can update base URI", async function () {
      await expect(nft.connect(owner).setBaseURI("ipfs://NEW_CID/"))
        .to.emit(nft, "BaseURIUpdated")
        .withArgs("ipfs://NEW_CID/");

      console.log("Base URI updated");
    });
  });

  // ─────────────────────────────────────────
  // ERC20 Recovery
  // ─────────────────────────────────────────

  describe("ERC20 Recovery", function () {
    it("Admin can recover accidentally sent ERC-20 tokens", async function () {
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const mockToken = await MockERC20.deploy();
      await mockToken.deployed();

      const amount = ethers.utils.parseUnits("500", 18);
      await mockToken.connect(owner).transfer(nft.address, amount);

      await expect(
        nft.connect(owner).recoverERC20(mockToken.address, owner.address, amount)
      )
        .to.emit(nft, "ERC20Recovered")
        .withArgs(mockToken.address, owner.address, amount);

      console.log("Admin recovered accidentally sent ERC-20 tokens");
    });

    it("Non-admin cannot recover ERC-20 tokens", async function () {
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const mockToken = await MockERC20.deploy();
      await mockToken.deployed();

      await expect(
        nft.connect(addr1).recoverERC20(mockToken.address, addr1.address, 1)
      ).to.be.revertedWith(
        `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${await nft.ADMIN_ROLE()}`
      );
    });
  });

  // ─────────────────────────────────────────
  // renounceRole Protection
  // ─────────────────────────────────────────

  describe("renounceRole Protection", function () {
    it("Admin cannot renounce DEFAULT_ADMIN_ROLE", async function () {
      const adminRole = await nft.DEFAULT_ADMIN_ROLE();

      await expect(
        nft.connect(owner).renounceRole(adminRole, owner.address)
      ).to.be.revertedWith("Cannot renounce admin role");
    });

    it("ADMIN_ROLE can still be renounced", async function () {
      const adminRole = await nft.ADMIN_ROLE();

      await expect(
        nft.connect(owner).renounceRole(adminRole, owner.address)
      ).to.not.be.reverted;

      expect(await nft.hasRole(adminRole, owner.address)).to.equal(false);
    });
  });

  // ─────────────────────────────────────────
  // Edge Cases
  // ─────────────────────────────────────────

  describe("Edge Cases", function () {

    describe("Whitelist Edge Cases", function () {
      beforeEach(async function () {
        await nft.connect(owner).advancePhase();
      });

      it("Whitelisted address can still public mint after using whitelist mint", async function () {
        await nft.connect(addr1).whitelistMint(merkleProof, {
          value: ethers.utils.parseEther("0.03")
        });

        await nft.connect(owner).advancePhase();

        await expect(
          nft.connect(addr1).publicMint({
            value: ethers.utils.parseEther("0.05")
          })
        ).to.not.be.reverted;

        expect(await nft.totalMinted()).to.equal(2);
        console.log("Whitelisted addr1 minted again during public phase");
      });

      it("Overpayment on whitelist mint is accepted", async function () {
        await expect(
          nft.connect(addr1).whitelistMint(merkleProof, {
            value: ethers.utils.parseEther("0.99")
          })
        ).to.not.be.reverted;

        console.log("Overpayment accepted on whitelist mint");
      });

      it("Valid whitelisted address cannot use someone else's proof", async function () {
        // addr1 tries to use addr2's proof from the same tree
        const addr2Proof = getProof(tree, addr2.address);

        await expect(
          nft.connect(addr1).whitelistMint(addr2Proof, {
            value: ethers.utils.parseEther("0.03")
          })
        ).to.be.revertedWith("Invalid Merkle proof");
      });

      it("Empty proof fails", async function () {
        // Build a single-leaf tree so empty proof has nothing to verify against
        const singleTree = buildTree([ethers.Wallet.createRandom().address]);
        const singleRoot = singleTree.getHexRoot();

        const freshNft = await NftMembership.deploy(
          "Membership Pass",
          "PASS",
          1000,
          ethers.utils.parseEther("0.05"),
          ethers.utils.parseEther("0.03"),
          "ipfs://TEST_CID/",
          singleRoot
        );
        await freshNft.deployed();
        await freshNft.connect(owner).advancePhase();

        await expect(
          freshNft.connect(addr1).whitelistMint([], {
            value: ethers.utils.parseEther("0.03")
          })
        ).to.be.revertedWith("Invalid Merkle proof");
      });
    });

    describe("Public Mint Edge Cases", function () {
      beforeEach(async function () {
        await nft.connect(owner).advancePhase();
        await nft.connect(owner).advancePhase();
      });

      it("Overpayment on public mint is accepted", async function () {
        await expect(
          nft.connect(addr2).publicMint({
            value: ethers.utils.parseEther("0.99")
          })
        ).to.not.be.reverted;

        console.log("Overpayment accepted on public mint");
      });
    });

    describe("Supply Edge Cases", function () {
      it("totalMinted increments correctly across whitelist and public mints", async function () {
        await nft.connect(owner).advancePhase();
        await nft.connect(addr1).whitelistMint(merkleProof, {
          value: ethers.utils.parseEther("0.03")
        });
        expect(await nft.totalMinted()).to.equal(1);

        await nft.connect(owner).advancePhase();
        await nft.connect(addr2).publicMint({
          value: ethers.utils.parseEther("0.05")
        });
        expect(await nft.totalMinted()).to.equal(2);

        console.log("totalMinted incremented correctly across both phases");
      });

      it("Last token mints successfully at max supply", async function () {
        const smallNft = await NftMembership.deploy(
          "Membership Pass",
          "PASS",
          2,
          ethers.utils.parseEther("0.05"),
          ethers.utils.parseEther("0.03"),
          "ipfs://TEST_CID/",
          merkleRoot
        );
        await smallNft.deployed();
        await smallNft.connect(owner).advancePhase();
        await smallNft.connect(owner).advancePhase();

        await smallNft.connect(addr1).publicMint({
          value: ethers.utils.parseEther("0.05")
        });
        await expect(
          smallNft.connect(addr2).publicMint({
            value: ethers.utils.parseEther("0.05")
          })
        ).to.not.be.reverted;

        expect(await smallNft.totalMinted()).to.equal(2);
        console.log("Last token minted successfully at max supply");
      });
    });

    describe("Withdraw Edge Cases", function () {
      it("Cannot withdraw to zero address", async function () {
        await nft.connect(owner).advancePhase();
        await nft.connect(owner).advancePhase();
        await nft.connect(addr1).publicMint({
          value: ethers.utils.parseEther("0.05")
        });

        await expect(
          nft.connect(owner).withdraw(ethers.constants.AddressZero)
        ).to.be.revertedWith("Cannot withdraw to zero address");
      });
    });

    describe("Transfer Edge Cases", function () {
      beforeEach(async function () {
        await nft.connect(owner).advancePhase();
        await nft.connect(owner).advancePhase();
        await nft.connect(addr1).publicMint({
          value: ethers.utils.parseEther("0.05")
        });
      });

      it("Token transfers correctly between wallets", async function () {
        await nft.connect(addr1).transferFrom(addr1.address, addr2.address, 1);

        expect(await nft.ownerOf(1)).to.equal(addr2.address);
        console.log("Token #1 transferred from addr1 to addr2");
      });

      it("Approved operator can transfer on behalf of owner", async function () {
        await nft.connect(addr1).approve(addr2.address, 1);

        await expect(
          nft.connect(addr2).transferFrom(addr1.address, addr2.address, 1)
        ).to.not.be.reverted;

        expect(await nft.ownerOf(1)).to.equal(addr2.address);
        console.log("addr2 transferred token #1 on behalf of addr1");
      });
    });
  });
});