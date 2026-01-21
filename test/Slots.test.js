import hre from "hardhat";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";

describe("Slots Contract", function () {
  describe("Slot management", function () {
    it("Should revert if chain is not registered", async function () {
      await expect(
        bridge.connect(validators[0]).submitLastObservedBlocks(3, cardanoBlocks)
      ).to.be.revertedWithCustomError(bridge, "ChainIsNotRegistered");
    });

    it("Should revert if there is new validator set pending", async function () {
      const systemSigner = await impersonateAsContractAndMintFunds("0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE");

      await bridge.connect(systemSigner).submitNewValidatorSet(newValidatorSetDelta);

      await expect(
        bridge.connect(validators[0]).submitLastObservedBlocks(1, cardanoBlocks)
      ).to.be.revertedWithCustomError(bridge, "NewValidatorSetPending");
    });

    it("Should revert if there are too many blocks", async function () {
      const cardanoBlocksTooManyBlocks = Array.from({ length: 41 }, (_, i) => ({
        blockSlot: i + 1,
        blockHash: `0x${"74657374".padEnd(64, "0")}${(i + 1).toString(16).padStart(2, "0")}`.slice(0, 66),
      }));

      await expect(
        bridge.connect(validators[0]).submitLastObservedBlocks(1, cardanoBlocksTooManyBlocks)
      ).to.be.revertedWithCustomError(bridge, "TooManyBlocks");
    });

    it("Should revert if not called by validator", async function () {
      await expect(bridge.connect(owner).submitLastObservedBlocks(1, cardanoBlocks)).to.be.revertedWithCustomError(
        bridge,
        "NotValidator"
      );
    });

    it("Should skip if validator submitted the same CardanoBlocks twice", async function () {
      await bridge.connect(validators[0]).submitLastObservedBlocks(1, cardanoBlocks);
      await bridge.connect(validators[1]).submitLastObservedBlocks(1, cardanoBlocks);
      await bridge.connect(validators[2]).submitLastObservedBlocks(1, cardanoBlocks);

      var blockSlot = (await bridge.getLastObservedBlock(1)).blockSlot;
      expect(blockSlot).to.equal(0);

      await bridge.connect(validators[2]).submitLastObservedBlocks(1, cardanoBlocks);

      blockSlot = (await bridge.getLastObservedBlock(1)).blockSlot;
      expect(blockSlot).to.equal(0);
    });

    it("Should update CardanoBlock when there is quorum", async function () {
      await bridge.connect(validators[0]).submitLastObservedBlocks(1, cardanoBlocks);
      await bridge.connect(validators[1]).submitLastObservedBlocks(1, cardanoBlocks);
      await bridge.connect(validators[2]).submitLastObservedBlocks(1, cardanoBlocks);

      var blockSlot = (await bridge.getLastObservedBlock(1)).blockSlot;
      expect(blockSlot).to.equal(0);

      await bridge.connect(validators[3]).submitLastObservedBlocks(1, cardanoBlocks);

      blockSlot = (await bridge.getLastObservedBlock(1)).blockSlot;
      expect(blockSlot).to.equal(cardanoBlocks[1].blockSlot);
    });

    it("Should not update CardanoBlock when slot is not newer", async function () {
      await bridge.connect(validators[0]).submitLastObservedBlocks(1, cardanoBlocks);
      await bridge.connect(validators[1]).submitLastObservedBlocks(1, cardanoBlocks);
      await bridge.connect(validators[2]).submitLastObservedBlocks(1, cardanoBlocks);
      await bridge.connect(validators[3]).submitLastObservedBlocks(1, cardanoBlocks);

      var blockSlot = (await bridge.getLastObservedBlock(1)).blockSlot;
      expect(blockSlot).to.equal(cardanoBlocks[1].blockSlot);

      const cardanoBlocksOld = [
        {
          blockSlot: 0,
          blockHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
        },
      ];

      await bridge.connect(validators[0]).submitLastObservedBlocks(1, cardanoBlocksOld);
      await bridge.connect(validators[1]).submitLastObservedBlocks(1, cardanoBlocksOld);
      await bridge.connect(validators[2]).submitLastObservedBlocks(1, cardanoBlocksOld);
      await bridge.connect(validators[3]).submitLastObservedBlocks(1, cardanoBlocksOld);

      blockSlot = (await bridge.getLastObservedBlock(1)).blockSlot;
      expect(blockSlot).to.equal(cardanoBlocks[1].blockSlot);
    });

    it("updateBlocks from Slots SC should revert if not called by Bridge SC", async function () {
      await expect(slots.connect(owner).updateBlocks(1, cardanoBlocks, owner.address)).to.be.revertedWithCustomError(
        bridge,
        "NotBridge"
      );
    });
  });

  async function impersonateAsContractAndMintFunds(contractAddress) {
    const address = contractAddress.toLowerCase();

    // impersonate as a contract on specified address
    await provider.send("hardhat_impersonateAccount", [address]);

    const signer = await ethers.getSigner(address);

    // minting 100000000000000000000 tokens to signer
    await provider.send("hardhat_setBalance", [signer.address, "0x56BC75E2D63100000"]);

    return signer;
  }

  let bridge;
  let owner;
  let validators;
  let slots;
  let cardanoBlocks;
  let chain1;
  let chain2;
  let validatorAddressChainData;
  let newValidatorSetDelta;
  let fixture;
  let provider;
  let ethers;

  beforeEach(async function () {
    fixture = await deployBridgeFixture(hre);

    bridge = fixture.bridge;
    owner = fixture.owner;
    validators = fixture.validators;
    chain1 = fixture.chain1;
    chain2 = fixture.chain2;
    slots = fixture.slots;
    cardanoBlocks = fixture.cardanoBlocks;
    validatorAddressChainData = fixture.validatorAddressChainData;
    newValidatorSetDelta = fixture.newValidatorSetDelta;
    provider = fixture.provider;
    ethers = fixture.ethers;

    // Register chains
    await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
    await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
  });
});
