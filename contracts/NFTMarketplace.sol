// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

struct NFTListing {
   uint256 price;
   address seller;
}

contract NFTMarketplace is ERC721URIStorage, Ownable {

   using Counters for Counters.Counter;
   using SafeMath for uint256;

   Counters.Counter private _tokenIds;
   mapping(uint256 => NFTListing) private _listings;

   event NFTTransfer(uint256 tokenID, address to, string tokenURI, uint256 price);
   
   // if tokenURI is not empty string => NFT was created
   // if price is not 0 => NFT was listed
   // if price is 0 and tokenURI is empty string => NFT was transfered (either bought, or the listing was canceled)
   constructor() ERC721("Creatures NFT","CRTRNFT"){}

   function createNFT(string calldata tokenURI) public {
      _tokenIds.increment();
      uint256 currentId = _tokenIds.current();
      _safeMint(msg.sender, currentId);
      _setTokenURI(currentId, tokenURI);
      emit NFTTransfer(currentId, msg.sender, tokenURI, 0);
   }

   //listing
   function listNFT(uint256 tokenID, uint256 price) public {
      require(price > 0, "NFTMarketplace: price must be > 0");
      transferFrom(msg.sender, address(this), tokenID);
      _listings[tokenID] = NFTListing(price, msg.sender);
      emit NFTTransfer(tokenID, address(this), "", price);
   }

   //buying
   function buyNFT(uint256 tokenID) public payable {
      NFTListing memory listing = _listings[tokenID];
      require(listing.price > 0, "NFTMarketplace: NFT not listed for sale");
      require(msg.value == listing.price, "NFTMarketplace: incorrect price");
      ERC721(address(this)).transferFrom(address(this), msg.sender, tokenID);
      clearListing(tokenID);
      payable(listing.seller).transfer(listing.price.mul(95).div(100));
      emit NFTTransfer(tokenID, msg.sender, "", 0);
   }

   //cancel listing
   function cancelListing(uint256 tokenID) public {
      NFTListing memory listing = _listings[tokenID];
      require(listing.price > 0, "NFTMarketplace: NFT not listed for sale");
      require(listing.seller == msg.sender, "NFTMarketplace: You're not the owner of this NFT");
      transferFrom(address(this), msg.sender, tokenID);
      clearListing(tokenID);
      emit NFTTransfer(tokenID, msg.sender, "", 0);
   }

   function withdrawFunds() public onlyOwner{
      uint256 balanceContract = address(this).balance;
      require(balanceContract > 0, "NFTMArketplace: balance is 0");
      payable(owner()).transfer(balanceContract);
   }
 
   function clearListing(uint256 tokenID) private{
      _listings[tokenID].price = 0;
      _listings[tokenID].seller = address(0);
   }
}