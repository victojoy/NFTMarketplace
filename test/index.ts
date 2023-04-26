import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Contract} from "ethers";
import { ethers } from "hardhat";
import { NFTMarketplace__factory } from "../typechain-types";

describe("NFTMArketplace", () => {
  let nftMarketplace: Contract;
  let signers: SignerWithAddress[];

  before(async () => {
    // Deploy the NFTMarketplace contract
    const NFTMarketplace = await ethers.getContractFactory ('NFTMarketplace');
    nftMarketplace = await NFTMarketplace.deploy();
    await nftMarketplace.deployed;
    signers = await ethers.getSigners();
  });

  const createNFT = async (tokenURI: string) => {
    const transaction = await nftMarketplace.createNFT(tokenURI);
    const receipt = await transaction.wait();
    const tokenID = receipt.events[0].args.tokenId;
    return tokenID;
  }

  const createAndListNFT = async (price: number) => {
    const tokenID = await createNFT('some token URI');
    const transaction = await nftMarketplace.listNFT(tokenID,price);
    await transaction.wait();
    return tokenID;
  }

  describe("createNFT", () => {
    it("Should create NFT with correct owner and tokenURI", async () => {

      // Create NFT function
      const tokenURI = 'https://random-token.uri';
      const transaction = await nftMarketplace.createNFT(tokenURI);
      const receipt = await transaction.wait();
      const tokenID = receipt.events[0].args.tokenId;
  
      // Assert that newly created NFT URI is the same one sent to the createNFT function
      const mintedTokenURI = await nftMarketplace.tokenURI(tokenID);
      expect(mintedTokenURI).to.equal(tokenURI);
  
      // Assert that the owner of the newly created NFT is the address that started the transaction
      const ownerAddress = await nftMarketplace.ownerOf(tokenID);
      const currentAddress = await signers[0].getAddress();
      expect(ownerAddress).to.equal(currentAddress);

      // Assert that NFTTransfer event has the correct args
      const args = receipt.events[1].args;
      expect(args.tokenID).to.equal(tokenID);
      expect(args.from).to.equal(ethers.constants.AddressZero);
      expect(args.to).to.equal(ownerAddress);
      expect(args.tokenURI).to.equal(tokenURI);
      expect(args.price).to.equal(0);
    });
  });

  describe("listNFT", () => {
    const tokenURI = 'Some token URI';
    it("Should revert if price is zero", async () => {
      const tokenID = await createNFT(tokenURI);
      const transaction = nftMarketplace.listNFT(tokenID, 0);
      await expect(transaction).to.be.revertedWith("NFTMarketplace: price must be > 0");
    });

    it("Should revert if not called by the owner", async () => {
      const tokenID = await createNFT(tokenURI);
      const transaction = nftMarketplace.connect(signers[1]).listNFT(tokenID, 1);
      await expect(transaction).to.be.revertedWith("ERC721: caller is not token owner or approved");
    });

    it("Should list the token for sale if all requirements are met", async () => {
      const price = 123;
      const tokenID = await createNFT(tokenURI);
      const transaction = await nftMarketplace.listNFT(tokenID, price);
      const receipt = await transaction.wait();
      // Ownership should be transfered to the NFTMarketplace contract
      const ownerAddress = await nftMarketplace.ownerOf(tokenID);
      expect(ownerAddress).to.equal(nftMarketplace.address);
      // NFTransfer event should have the right args 
      const args = receipt.events[1].args;
      expect(args.tokenID).to.equal(tokenID);
      expect(args.from).to.equal(signers[0].address);
      expect(args.to).to.equal(nftMarketplace.address);
      expect(args.tokenURI).to.equal("");
      expect(args.price).to.equal(price);
    });
  });

  describe("buyNFT", () => {
    it("Should revert if NFT is not listed for sale", async () => {
      const transaction = nftMarketplace.buyNFT(888);
      expect(transaction).to.be.revertedWith("NFTMarketplace: nft not listed for sale");
    });

    it("Should revert if the amount of wei sent is not equal to the NFT price", async () => {
      const tokenID = await createAndListNFT(123);
      const transaction= nftMarketplace.buyNFT(tokenID, { value: 124 });
      await expect(transaction).to.be.revertedWith("NFTMarketplace: incorrect price");
    });

    it("Should transfer ownership to the buyer and send the money to the seller", async () => {
      const price = 123;
      const sellerProfit = Math.floor(price * 95 / 100);
      const fee = price - sellerProfit;
      const initialContractBalance = await nftMarketplace.provider.getBalance(nftMarketplace.address);
      const tokenID = await createAndListNFT(price);
      await new Promise(r => setTimeout(r, 100));
      const oldSellerBalance = await signers[0].getBalance();
      const transaction = await nftMarketplace.connect(signers[1]).buyNFT(tokenID, { value: price});
      const receipt = await transaction.wait();
      // 95% of funds was send to the seller
      await new Promise(r => setTimeout(r, 100));
      const newSellerBalance = await signers[0].getBalance();
      const diff = newSellerBalance.sub(oldSellerBalance);
      expect(diff).to.equal(sellerProfit);
      // 5% of funds was kept in the contract
      const newContractBalance = await nftMarketplace.provider.getBalance(nftMarketplace.address);
      const contractBalanceDiff = newContractBalance.sub(initialContractBalance);
      expect(contractBalanceDiff).to.equal(fee);
      // NFT ownership was transfered to the buyer
      const ownerAddress = await nftMarketplace.ownerOf(tokenID);
      expect(ownerAddress).to.equal(signers[1].address);
      // NFTTransfer event has the correct arguments
      const args = receipt.events[1].args;   
      expect(args.tokenID).to.equal(tokenID);
      expect(args.from).to.equal(nftMarketplace.address);
      expect(args.to).to.equal(signers[1].address);
      expect(args.tokenURI).to.equal("");
      expect(args.price).to.equal(0);
    });
  });

  describe("cancelListing", () => {
    it("Should revert if the NFT is not listed for sale", async () => {
      const transaction = nftMarketplace.cancelListing(9999);
      await expect(transaction).to.be.revertedWith("NFTMarketplace: NFT not listed for sale");
    });

    it("should revert if the caller is not the seller of the listings", async () => {
      const tokenID = await createAndListNFT(123);
      const transaction = nftMarketplace.connect(signers[1]).cancelListing(tokenID);
      expect(transaction).to.be.revertedWith("NFTMarketplace: You're not the owner of this NFT");
    });

    it("Should transfer the ownership back to the seller if all requirements are met", async () => {
      const tokenID = await createAndListNFT(123);
      const transaction = await nftMarketplace.cancelListing(tokenID);
      const receipt = await transaction.wait();
      //check ownership
      const ownerAddress = await nftMarketplace.ownerOf(tokenID);
      expect(ownerAddress).to.equal(signers[0].address);
      //check NFTTransfer 
      const args = receipt.events[1].args;
      expect(args.tokenID).to.equal(tokenID);
      expect(args.from).to.equal(nftMarketplace.address);
      expect(args.to).to.equal(signers[0].address);
      expect(args.tokenURI).to.equal("");
      expect(args.price).to.equal(0);
    });
  });

  describe("withdrawFunds", () => {
    it("Should revert if called by a signer ither than the owner", async () => {
      const transaction = nftMarketplace.connect(signers[1]).withdrawFunds();
      await expect(transaction).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should transfer all funds from the constract to the owner's", async () => {
      const contractBalance = await nftMarketplace.provider.getBalance(nftMarketplace.address);
      const initialOwnerBalance = await signers[0].getBalance();
      const transaction = await nftMarketplace.withdrawFunds();
      const receipt = await transaction.wait();

      await new Promise((r) => setTimeout(r, 100));
      const newOwnerBalance = await signers[0].getBalance();

      const gas = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      const transfered = newOwnerBalance.add(gas).sub(initialOwnerBalance);
      expect(transfered).to.equal(contractBalance);
    });

    it("Should revert if contract balance is zero", async () => {
      const transaction = nftMarketplace.withdrawFunds();
      await expect(transaction).to.be.revertedWith("NFTMArketplace: balance is 0");
    });
  });
});