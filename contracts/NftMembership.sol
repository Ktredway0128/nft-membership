// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title NftMembership - An ERC-721 membership pass with phased minting
/// @author Kyle Tredway
/// @notice Membership pass with whitelist and public mint phases, configurable supply and price
/// @dev Uses OpenZeppelin: ERC721, ERC721Burnable, ERC721Pausable, AccessControl, MerkleProof

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";


contract NftMembership is
    ERC721,
    ERC721Burnable,
    ERC721Pausable,
    AccessControl
{
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // Mint phases
    enum Phase { Paused, Whitelist, Public }
    Phase public currentPhase;

    // Config
    uint256 public maxSupply;
    uint256 public mintPrice;
    uint256 public whitelistMintPrice;
    string private _baseTokenURI;
    bytes32 public merkleRoot;

    // Tracking
    uint256 public totalMinted;
    mapping(address => bool) public whitelistClaimed;

    // Events
    event PhaseAdvanced(Phase newPhase);
    event MerkleRootUpdated(bytes32 newRoot);
    event MintPriceUpdated(uint256 newPrice);
    event WhitelistMintPriceUpdated(uint256 newPrice);
    event BaseURIUpdated(string newURI);
    event Withdrawn(address indexed to, uint256 amount);
    event PassMinted(address indexed to, uint256 tokenId);
    event PassBurned(address indexed from, uint256 tokenId);
    event ERC20Recovered(address indexed token, address indexed to, uint256 amount);

    /// @notice Constructor: sets token name, symbol, supply, prices, URI, and merkle root
    /// @param name Token name
    /// @param symbol Token symbol
    /// @param _maxSupply Maximum number of passes
    /// @param _mintPrice Public mint price in wei
    /// @param _whitelistMintPrice Whitelist mint price in wei
    /// @param baseURI IPFS URI pointing to membership card metadata
    /// @param _merkleRoot Merkle root for whitelist verification
    constructor(
        string memory name,
        string memory symbol,
        uint256 _maxSupply,
        uint256 _mintPrice,
        uint256 _whitelistMintPrice,
        string memory baseURI,
        bytes32 _merkleRoot
    ) ERC721(name, symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);

        maxSupply = _maxSupply;
        mintPrice = _mintPrice;
        whitelistMintPrice = _whitelistMintPrice;
        _baseTokenURI = baseURI;
        merkleRoot = _merkleRoot;
        currentPhase = Phase.Paused;
    }

    // ─────────────────────────────────────────
    // Minting
    // ─────────────────────────────────────────

    /// @notice Whitelist mint — requires valid Merkle proof, one per address
    /// @param proof Merkle proof for the caller
    function whitelistMint(bytes32[] calldata proof) external payable whenNotPaused {
        require(currentPhase == Phase.Whitelist, "Whitelist phase not active");
        require(!whitelistClaimed[msg.sender], "Already claimed whitelist mint");
        require(msg.value >= whitelistMintPrice, "Insufficient payment");
        require(totalMinted < maxSupply, "Max supply reached");

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        require(MerkleProof.verify(proof, merkleRoot, leaf), "Invalid Merkle proof");

        whitelistClaimed[msg.sender] = true;
        _mintPass(msg.sender);
    }

    /// @notice Public mint — open to anyone during public phase
    function publicMint() external payable whenNotPaused {
        require(currentPhase == Phase.Public, "Public phase not active");
        require(msg.value >= mintPrice, "Insufficient payment");
        require(totalMinted < maxSupply, "Max supply reached");

        _mintPass(msg.sender);
    }

    /// @dev Internal mint logic
    function _mintPass(address to) internal {
        uint256 tokenId = totalMinted + 1;
        totalMinted++;
        _safeMint(to, tokenId);
        emit PassMinted(to, tokenId);
    }

    // ─────────────────────────────────────────
    // Phase Management
    // ─────────────────────────────────────────

    /// @notice Advance to the next phase — forward only, no going back
    function advancePhase() external onlyRole(ADMIN_ROLE) {
        require(uint8(currentPhase) < 2, "Already at final phase");
        currentPhase = Phase(uint8(currentPhase) + 1);
        emit PhaseAdvanced(currentPhase);
    }

    /// @notice Emergency pause regardless of phase
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /// @notice Resume from pause
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // ─────────────────────────────────────────
    // Admin Config
    // ─────────────────────────────────────────

    /// @notice Update the Merkle root — useful before whitelist phase opens
    function setMerkleRoot(bytes32 _merkleRoot) external onlyRole(ADMIN_ROLE) {
        merkleRoot = _merkleRoot;
        emit MerkleRootUpdated(_merkleRoot);
    }

    /// @notice Update public mint price
    function setMintPrice(uint256 _mintPrice) external onlyRole(ADMIN_ROLE) {
        mintPrice = _mintPrice;
        emit MintPriceUpdated(_mintPrice);
    }

    /// @notice Update whitelist mint price
    function setWhitelistMintPrice(uint256 _price) external onlyRole(ADMIN_ROLE) {
        whitelistMintPrice = _price;
        emit WhitelistMintPriceUpdated(_price);
    }

    /// @notice Update base URI for token metadata
    function setBaseURI(string memory baseURI) external onlyRole(ADMIN_ROLE) {
        _baseTokenURI = baseURI;
        emit BaseURIUpdated(baseURI);
    }

    /// @notice Withdraw ETH collected from mints
    function withdraw(address payable to) external onlyRole(ADMIN_ROLE) {
        require(to != address(0), "Cannot withdraw to zero address");
        uint256 balance = address(this).balance;
        require(balance > 0, "Nothing to withdraw");
        (bool success, ) = to.call{value: balance}("");
        require(success, "Withdraw failed");
        emit Withdrawn(to, balance);
    }

    /// @notice Recover ERC-20 tokens accidentally sent to this contract
    /// @param token The ERC-20 token contract address
    /// @param to Recipient address
    /// @param amount Amount to recover
    function recoverERC20(address token, address to, uint256 amount) external onlyRole(ADMIN_ROLE) {
        require(to != address(0), "Cannot recover to zero address");
        bool success = IERC20(token).transfer(to, amount);
        require(success, "Token recovery failed");
        emit ERC20Recovered(token, to, amount);
    }

    // ─────────────────────────────────────────
    // Overrides
    // ─────────────────────────────────────────

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function burn(uint256 tokenId) public override {
        super.burn(tokenId);
        emit PassBurned(msg.sender, tokenId);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Pausable) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /// @dev Prevents admin from accidentally locking the contract
    function renounceRole(bytes32 role, address account) public override {
        require(role != DEFAULT_ADMIN_ROLE, "Cannot renounce admin role");
        super.renounceRole(role, account);
    }
}