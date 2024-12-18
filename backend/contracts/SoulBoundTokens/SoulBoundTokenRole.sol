// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SoulBound Token Role Contract
 * @author Damien Schneider
 * @notice Manages role-based access control through non-transferable NFTs
 * @dev Implements ERC721 with transfer restrictions and role management
 */
contract SoulBoundTokenRole is ERC721, Ownable {
    uint256 private _tokenIdCounter = 1;

    enum Role {
        TaskProvider,
        TaskDeveloper,
        TaskAuditor
    }

    uint256 public constant MAX_SUPPLY = 1000;

    mapping(uint256 => Role) public tokenRole;
    mapping(address => bool) public hasToken;

    event SBTMinted(address indexed to, uint256 tokenId, Role role);

    constructor() ERC721("OpenTaskRole", "OTR") Ownable(msg.sender) {}

    /**
     * @notice Mints a new role token to an address
     * @dev Only callable by owner (TaskMarketplace contract), implements role-based access control
     * @param to Address to receive the role token
     * @param role Role to assign to the token
     */
    function safeMint(address to, Role role) public onlyOwner {
        require(_tokenIdCounter < MAX_SUPPLY, "Creation limit reached");
        require(!hasToken[to], "Address already owns a SBT");
        
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter += 1;
        
        tokenRole[tokenId] = role;
        hasToken[to] = true;
        
        emit SBTMinted(to, tokenId, role);
        _safeMint(to, tokenId);
    }

    /**
     * @notice Override of ERC721 _update to prevent token transfers
     * @dev Implements the "soulbound" aspect of the token
     * @param to Destination address
     * @param tokenId Token ID being updated
     * @param auth Address performing the update
     * @return address The from address
     */
    function _update(address to, uint256 tokenId, address auth) internal override(ERC721) returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert("Soulbound: Transfer not allowed");
        }
        return super._update(to, tokenId, auth);
    }

    /**
     * @notice Gets the role associated with an address
     * @dev Iterates through tokens to find the role
     * @param account Address to check
     * @return Role The role associated with the address
     */
    function getRole(address account) public view returns (Role) {
        uint256 tokenIdCounter = _tokenIdCounter;
        for (uint256 i = 1; i < tokenIdCounter; i++) {
            if (ownerOf(i) == account) {
                return tokenRole[i];
            }
        }
        revert("No SBT found for this address");
    }

    /**
     * @notice Gets the current token ID counter
     * @return uint256 Current token ID counter value
     */
    function getTokenIdCounter() public view returns (uint256) {
        return _tokenIdCounter;
    }
}
