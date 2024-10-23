import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";

describe("Data Pruning", function () {
  it("Hash should be added to claimsHashes in ClaimsHelper when new claim is submitted", async function () {
    const { bridge, claimsHelper, owner, chain1, chain2, validators, validatorClaimsBRC, validatorsCardanoData } =
      await loadFixture(deployBridgeFixture);

    await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
    await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);

    const abiCoder = new ethers.AbiCoder();
    const encodedPrefix = abiCoder.encode(["string"], ["BRC"]);
    const encoded = abiCoder.encode(
      ["bytes32", "tuple(uint64, string)[]", "uint256", "uint256", "uint8", "uint8"],
      [
        validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash,
        [
          [
            validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount,
            validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress,
          ],
        ],
        validatorClaimsBRC.bridgingRequestClaims[0].totalAmount,
        validatorClaimsBRC.bridgingRequestClaims[0].retryCounter,
        validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId,
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
      ]
    );
    const encoded40 =
      "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080" +
      encodedPrefix.substring(66) +
      encoded.substring(2);
    const hash = ethers.keccak256(encoded40);

    expect((await claimsHelper.getClaimsHashes()).length).to.be.equal(0);

    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);

    expect((await claimsHelper.getClaimsHashes()).length).to.be.equal(1);
    expect((await claimsHelper.claimsHashes(0)).hashValue).to.be.equal(hash);
  });

  it("Only NEW Hashes should be added to claimsHashes in ClaimsHelper when new claim is submitted", async function () {
    const { bridge, claimsHelper, owner, chain1, chain2, validators, validatorClaimsBRC, validatorsCardanoData } =
      await loadFixture(deployBridgeFixture);

    await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
    await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);

    const abiCoder = new ethers.AbiCoder();
    const encodedPrefix = abiCoder.encode(["string"], ["BRC"]);
    const encoded = abiCoder.encode(
      ["bytes32", "tuple(uint64, string)[]", "uint256", "uint256", "uint8", "uint8"],
      [
        validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash,
        [
          [
            validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount,
            validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress,
          ],
        ],
        validatorClaimsBRC.bridgingRequestClaims[0].totalAmount,
        validatorClaimsBRC.bridgingRequestClaims[0].retryCounter,
        validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId,
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
      ]
    );
    const encoded40 =
      "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080" +
      encodedPrefix.substring(66) +
      encoded.substring(2);
    const hash = ethers.keccak256(encoded40);

    expect((await claimsHelper.getClaimsHashes()).length).to.be.equal(0);

    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);

    expect((await claimsHelper.getClaimsHashes()).length).to.be.equal(1);

    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);

    expect((await claimsHelper.getClaimsHashes()).length).to.be.equal(1);
    expect((await claimsHelper.claimsHashes(0)).hashValue).to.be.equal(hash);
  });
  it("Should revert if pruneSC is not called by owner", async function () {
    const { claimsHelper, validators } = await loadFixture(deployBridgeFixture);

    const validatorsAddresses = [];
    for (let i = 0; i < validators.length; i++) {
      validatorsAddresses.push(validators[i].address);
    }

    await expect(claimsHelper.connect(validators[0]).pruneSC(4, validatorsAddresses, 5)).to.be.revertedWithCustomError(
      claimsHelper,
      "OwnableUnauthorizedAccount"
    );
  });
  it("Calling pruneSC should NOT remove hash if quorum is NOT reached and ttl has NOT passed", async function () {
    const { bridge, claimsHelper, owner, validators, validatorClaimsBRC, chain1, chain2, validatorsCardanoData } =
      await loadFixture(deployBridgeFixture);

    await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
    await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);

    const abiCoder = new ethers.AbiCoder();
    const encodedPrefix = abiCoder.encode(["string"], ["BRC"]);
    const encoded = abiCoder.encode(
      ["bytes32", "tuple(uint64, string)[]", "uint256", "uint256", "uint8", "uint8"],
      [
        validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash,
        [
          [
            validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount,
            validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress,
          ],
        ],
        validatorClaimsBRC.bridgingRequestClaims[0].totalAmount,
        validatorClaimsBRC.bridgingRequestClaims[0].retryCounter,
        validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId,
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
      ]
    );
    const encoded40 =
      "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080" +
      encodedPrefix.substring(66) +
      encoded.substring(2);
    const hash = ethers.keccak256(encoded40);

    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);

    const validatorsAddresses = [];
    for (let i = 0; i < validators.length; i++) {
      validatorsAddresses.push(validators[i].address);
    }

    await claimsHelper.connect(owner).pruneSC(4, validatorsAddresses, 5);

    expect((await claimsHelper.getClaimsHashes()).length).to.be.equal(1);
    expect((await claimsHelper.claimsHashes(0)).hashValue).to.be.equal(hash);
  });
  it("Calling pruneSC should remove hash if quorum is NOT reached and ttl has been passed", async function () {
    const { bridge, claimsHelper, owner, validators, validatorClaimsBRC, chain1, chain2, validatorsCardanoData } =
      await loadFixture(deployBridgeFixture);

    await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
    await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);

    const abiCoder = new ethers.AbiCoder();
    const encodedPrefix = abiCoder.encode(["string"], ["BRC"]);
    const encoded = abiCoder.encode(
      ["bytes32", "tuple(uint64, string)[]", "uint256", "uint256", "uint8", "uint8"],
      [
        validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash,
        [
          [
            validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount,
            validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress,
          ],
        ],
        validatorClaimsBRC.bridgingRequestClaims[0].totalAmount,
        validatorClaimsBRC.bridgingRequestClaims[0].retryCounter,
        validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId,
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
      ]
    );
    const encoded40 =
      "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080" +
      encodedPrefix.substring(66) +
      encoded.substring(2);
    const hash = ethers.keccak256(encoded40);

    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);

    const validatorsAddresses = [];
    for (let i = 0; i < validators.length; i++) {
      validatorsAddresses.push(validators[i].address);
    }

    for (let i = 0; i < 2; i++) {
      await ethers.provider.send("evm_mine");
    }

    expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.be.equal(true);
    expect(await claimsHelper.hasVoted(hash, validators[1].address)).to.be.equal(true);
    expect(await claimsHelper.hasVoted(hash, validators[2].address)).to.be.equal(true);
    expect(await claimsHelper.numberOfVotes(hash)).to.be.equal(3);

    await claimsHelper.connect(owner).pruneSC(4, validatorsAddresses, 5);

    expect((await claimsHelper.getClaimsHashes()).length).to.be.equal(0);
    expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.be.equal(false);
    expect(await claimsHelper.hasVoted(hash, validators[1].address)).to.be.equal(false);
    expect(await claimsHelper.hasVoted(hash, validators[2].address)).to.be.equal(false);
    expect(await claimsHelper.numberOfVotes(hash)).to.be.equal(0);
  });
  it("Calling pruneSC should remove hash if quorum is reached", async function () {
    const { bridge, claimsHelper, owner, validators, validatorClaimsBRC, chain1, chain2, validatorsCardanoData } =
      await loadFixture(deployBridgeFixture);

    await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
    await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);

    const abiCoder = new ethers.AbiCoder();
    const encodedPrefix = abiCoder.encode(["string"], ["BRC"]);
    const encoded = abiCoder.encode(
      ["bytes32", "tuple(uint64, string)[]", "uint256", "uint256", "uint8", "uint8"],
      [
        validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash,
        [
          [
            validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount,
            validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress,
          ],
        ],
        validatorClaimsBRC.bridgingRequestClaims[0].totalAmount,
        validatorClaimsBRC.bridgingRequestClaims[0].retryCounter,
        validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId,
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
      ]
    );
    const encoded40 =
      "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080" +
      encodedPrefix.substring(66) +
      encoded.substring(2);
    const hash = ethers.keccak256(encoded40);

    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

    const validatorsAddresses = [];
    for (let i = 0; i < validators.length; i++) {
      validatorsAddresses.push(validators[i].address);
    }

    expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.be.equal(true);
    expect(await claimsHelper.hasVoted(hash, validators[1].address)).to.be.equal(true);
    expect(await claimsHelper.hasVoted(hash, validators[2].address)).to.be.equal(true);
    expect(await claimsHelper.hasVoted(hash, validators[3].address)).to.be.equal(true);
    expect(await claimsHelper.numberOfVotes(hash)).to.be.equal(4);

    await claimsHelper.connect(owner).pruneSC(4, validatorsAddresses, 5);

    expect((await claimsHelper.getClaimsHashes()).length).to.be.equal(0);
    expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.be.equal(false);
    expect(await claimsHelper.hasVoted(hash, validators[1].address)).to.be.equal(false);
    expect(await claimsHelper.hasVoted(hash, validators[2].address)).to.be.equal(false);
    expect(await claimsHelper.hasVoted(hash, validators[3].address)).to.be.equal(false);
    expect(await claimsHelper.numberOfVotes(hash)).to.be.equal(0);
  });
});
