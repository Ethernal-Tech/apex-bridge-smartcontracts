import hre from "hardhat";
import { expect } from "chai";
import { BatchType, deployBridgeFixture } from "./fixtures";

describe("Batch creation", function () {
  it("SignedBatch submition should return imediatelly if chain is not registered", async function () {
    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

    // wait for next timeout
    for (let i = 0; i < 8; i++) {
      await connection.ethers.provider.send("evm_mine");
    }

    const signedBatch_UnregisteredChain = {
      id: 1,
      firstTxNonceId: 1,
      lastTxNonceId: 1,
      destinationChainId: 3, //unregistered chain
      signature: "0x7465737400000000000000000000000000000000000000000000000000000000",
      feeSignature: "0x7465737400000000000000000000000000000000000000000000000000000000",
      rawTransaction: "0x7465737400000000000000000000000000000000000000000000000000000000",
      batchType: BatchType.NORMAL,
      stakeSignature: "0x7465737400000000000000000000000000000000000000000000000000000000",
    };

    expect(await bridge.connect(validators[0]).submitSignedBatch(signedBatch_UnregisteredChain)).not.to.revert(ethers); // submitSignedBatch should return for unregistered chain
  });

  it("SignedBatch submition should be reverted if not called by validator", async function () {
    await expect(bridge.connect(owner).submitSignedBatch(signedBatch)).to.be.revertedWithCustomError(
      bridge,
      "NotValidator",
    );
  });

  it("Should revert signedBatch submition if signature is not valid", async function () {
    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

    for (let i = 0; i < 5; i++) {
      await connection.ethers.provider.send("evm_mine");
    }

    await validatorsc.setAdditionalDependenciesAndSync(
      registration.target,
      mockPrecompileFalse.target,
      mockPrecompileFalse.target,
      true,
    );

    await expect(bridge.connect(validators[0]).submitSignedBatch(signedBatch)).to.be.revertedWithCustomError(
      bridge,
      "InvalidSignature",
    );
  });

  it("SignedBatch submition in SignedBatches SC should be reverted if not called by Bridge SC", async function () {
    await expect(
      signedBatches.connect(owner).submitSignedBatch(signedBatch, owner.address, false),
    ).to.be.revertedWithCustomError(bridge, "NotBridge");
  });

  it("If SignedBatch submition id is not expected submission should be skipped", async function () {
    const encoded = connection.ethers.solidityPacked(
      ["uint64", "uint64", "uint64", "uint8", "bytes", "uint8"],
      [
        signedBatch.id,
        signedBatch.firstTxNonceId,
        signedBatch.lastTxNonceId,
        signedBatch.destinationChainId,
        signedBatch.rawTransaction,
        signedBatch.batchType,
      ],
    );

    const hash = connection.ethers.keccak256(encoded);

    const bridgeContract = await impersonateAsContractAndMintFunds(await bridge.getAddress());

    await signedBatches.connect(bridgeContract).submitSignedBatch(signedBatch, validators[0].address, false);

    expect(await hasVotedSignedBatches(hash, validators[0].address)).to.equal(true);

    const temp_signedBatch = structuredClone(signedBatch);
    temp_signedBatch.id = 1000;

    const encodedFalse = ethers.solidityPacked(
      ["uint64", "uint64", "uint64", "uint8", "bytes", "bool"],
      [
        temp_signedBatch.id,
        temp_signedBatch.firstTxNonceId,
        temp_signedBatch.lastTxNonceId,
        temp_signedBatch.destinationChainId,
        temp_signedBatch.rawTransaction,
        temp_signedBatch.batchType,
      ],
    );

    const hashFalse = ethers.keccak256(encodedFalse);

    await signedBatches.connect(bridgeContract).submitSignedBatch(temp_signedBatch, validators[0].address, false);

    expect(await hasVotedSignedBatches(hashFalse, validators[0])).to.equal(false);
  });

  it("SignedBatch submition should do nothing if shouldCreateBatch is false", async function () {
    const hash = connection.ethers.solidityPackedKeccak256(
      ["uint64", "uint64", "uint64", "uint8", "bytes", "bool"],
      [
        signedBatch.id,
        signedBatch.firstTxNonceId,
        signedBatch.lastTxNonceId,
        signedBatch.destinationChainId,
        signedBatch.rawTransaction,
        false,
      ],
    );

    await bridge.connect(validators[0]).submitSignedBatch(signedBatch);

    // const validatorIndex = Number(await validatorsc.getValidatorIndex(validators[0])) - 1;

    expect(await hasVotedClaims(hash, validators[0])).to.equal(false);
  });

  it("getNextBatchId should return 0 if there are no confirmed claims", async function () {
    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);

    expect(await bridge.getNextBatchId(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(0);

    // wait for next timeout
    for (let i = 0; i < 10; i++) {
      await connection.ethers.provider.send("evm_mine");
    }

    expect(await bridge.getNextBatchId(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(0);
  });

  it("getNextBatchId should return correct id if there are enough confirmed claims", async function () {
    const validatorClaimsBRC2 = {
      ...validatorClaimsBRC,
      bridgingRequestClaims: [
        {
          ...validatorClaimsBRC.bridgingRequestClaims[0],
          observedTransactionHash: "0x7465737900000000000000000000000000000000000000000000000000000000",
        },
      ],
    };

    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC2);
    await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC2);
    await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC2);
    await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC2);

    for (let i = 0; i < 5; i++) {
      await connection.ethers.provider.send("evm_mine");
    }

    expect(await bridge.getNextBatchId(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(1);
  });

  it("getNextBatchId should return correct id if there is timeout", async function () {
    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

    // wait for timeout
    for (let i = 0; i < 7; i++) {
      await connection.ethers.provider.send("evm_mine");
    }

    expect(await bridge.getNextBatchId(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(1);
  });

  it("Should not create if current batch block is not -1", async function () {
    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

    // wait for next timeout
    for (let i = 0; i < 8; i++) {
      await connection.ethers.provider.send("evm_mine");
    }

    await bridge.connect(validators[4]).submitSignedBatch(signedBatch);
    await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
    await bridge.connect(validators[2]).submitSignedBatch(signedBatch);

    await bridge.connect(validators[1]).submitSignedBatch(signedBatch); // resubmit

    const confBatchNothing = await claimsHelper
      .connect(validators[0])
      .getConfirmedSignedBatchData(signedBatch.destinationChainId, signedBatch.id);
    expect(confBatchNothing.firstTxNonceId + confBatchNothing.lastTxNonceId).to.equal(0);

    // consensus
    await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

    expect(await claims.shouldCreateBatch(signedBatch.destinationChainId)).to.equal(false);

    const confBatch = await bridge.connect(validators[1]).getConfirmedBatch(signedBatch.destinationChainId);
    expect(confBatch.bitmap).to.equal(30);
  });

  it("Should not create ConfirmedBatch if not called by Validator", async function () {
    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

    // wait for next timeout
    for (let i = 0; i < 8; i++) {
      await connection.ethers.provider.send("evm_mine");
    }

    await expect(bridge.connect(owner).submitSignedBatchEVM(signedBatch)).to.be.revertedWithCustomError(
      bridge,
      "NotValidator",
    );
  });

  it("Should create ConfirmedBatch if there are enough votes", async function () {
    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

    // wait for next timeout
    for (let i = 0; i < 8; i++) {
      await connection.ethers.provider.send("evm_mine");
    }

    await bridge.connect(validators[0]).submitSignedBatchEVM(signedBatch);
    await bridge.connect(validators[1]).submitSignedBatchEVM(signedBatch);
    await bridge.connect(validators[2]).submitSignedBatchEVM(signedBatch);
    await bridge.connect(validators[3]).submitSignedBatchEVM(signedBatch);

    expect(
      (await bridge.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId)).rawTransaction,
    ).to.equal(signedBatch.rawTransaction);
    expect(
      (await bridge.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId)).signatures.length,
    ).to.equal(4);

    const confirmedBatch = await bridge.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId);
    expect(confirmedBatch.signatures[0]).to.deep.equal(signedBatch.signature);
    expect(confirmedBatch.signatures[1]).to.deep.equal(signedBatch.signature);
    expect(confirmedBatch.signatures[2]).to.deep.equal(signedBatch.signature);
    expect(confirmedBatch.signatures[3]).to.deep.equal(signedBatch.signature);
    expect(confirmedBatch.feeSignatures[2]).to.deep.equal(signedBatch.feeSignature);

    expect(await bridge.connect(validators[0]).getRawTransactionFromLastBatch(signedBatch.destinationChainId)).to.equal(
      signedBatch.rawTransaction,
    );
  });

  it("Should create and execute batch after transactions are confirmed", async function () {
    const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

    await expect(bridge.connect(validators[0]).getConfirmedTransactions(_destinationChain))
      .to.be.revertedWithCustomError(bridge, "CanNotCreateBatchYet")
      .withArgs(_destinationChain);

    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

    //every await in this describe is one block, so we need to wait 2 blocks to timeout (current timeout is 5 blocks)
    for (let i = 0; i < 7; i++) {
      await connection.ethers.provider.send("evm_mine");
    }

    const confirmedTxs = await bridge.connect(validators[0]).getConfirmedTransactions(_destinationChain);
    expect(confirmedTxs.length).to.equal(1);

    expect(await bridge.shouldCreateBatch(_destinationChain)).to.be.true;

    await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
    await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
    await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
    await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

    await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
    await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
    await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
    await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

    await expect(bridge.connect(validators[0]).getConfirmedTransactions(_destinationChain))
      .to.revertedWithCustomError(bridge, "CanNotCreateBatchYet")
      .withArgs(_destinationChain);
  });

  it("Should return appropriate token amount for signed batch", async function () {
    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

    // wait for next timeout
    for (let i = 0; i < 8; i++) {
      await connection.ethers.provider.send("evm_mine");
    }

    await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
    await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
    await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
    await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

    const tokenAmountDestination = await chainTokens.chainTokenQuantity(signedBatch.destinationChainId);
    const tokenWrappedAmountDestination = await chainTokens.chainWrappedTokenQuantity(signedBatch.destinationChainId);

    let sumAmount = 0;
    let sumWrappedAmount = 0;
    for (let i = 0; i < validatorClaimsBRC.bridgingRequestClaims[0].receivers.length; i++) {
      sumAmount += validatorClaimsBRC.bridgingRequestClaims[0].receivers[i].amount;
      sumWrappedAmount += validatorClaimsBRC.bridgingRequestClaims[0].receivers[i].amountWrapped;
    }

    expect(100 - sumAmount).to.equal(tokenAmountDestination);
    expect(100 - sumWrappedAmount).to.equal(tokenWrappedAmountDestination);
  });

  it("Should delete multisigSignatures and feePayerMultisigSignatures for confirmed signed batches", async function () {
    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

    // wait for next timeout
    for (let i = 0; i < 8; i++) {
      await connection.ethers.provider.send("evm_mine");
    }

    await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
    await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
    await bridge.connect(validators[2]).submitSignedBatch(signedBatch);

    const encoded = connection.ethers.solidityPacked(
      ["uint64", "uint64", "uint64", "uint8", "bytes", "uint8"],
      [
        signedBatch.id,
        signedBatch.firstTxNonceId,
        signedBatch.lastTxNonceId,
        signedBatch.destinationChainId,
        signedBatch.rawTransaction,
        BatchType.NORMAL,
      ],
    );

    const hash = ethers.keccak256(encoded);

    var numberOfSignatures = await signedBatches.getNumberOfSignatures(hash);

    expect(numberOfSignatures).to.equal(3);

    await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

    numberOfSignatures = await signedBatches.getNumberOfSignatures(hash);

    expect(numberOfSignatures).to.equal(0);
  });

  it("Should not update nextTimeoutBlock when it is a consolidation batch", async function () {
    const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

    const signedBatchConsolidation = structuredClone(signedBatch);
    signedBatchConsolidation.batchType = BatchType.CONSOLIDATION;
    signedBatchConsolidation.firstTxNonceId = 0;
    signedBatchConsolidation.lastTxNonceId = 0;

    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

    await bridge.connect(validators[0]).submitSignedBatch(signedBatchConsolidation);
    await bridge.connect(validators[1]).submitSignedBatch(signedBatchConsolidation);
    await bridge.connect(validators[2]).submitSignedBatch(signedBatchConsolidation);
    await bridge.connect(validators[3]).submitSignedBatch(signedBatchConsolidation);

    await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
    await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
    await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
    await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

    const nextBatchBlock = await claims.nextTimeoutBlock(_destinationChain);
    const currentBlock = await connection.ethers.provider.getBlockNumber();

    expect(nextBatchBlock).to.lessThan(currentBlock + 1);
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
  let claimsHelper;
  let claims;
  let chainTokens;
  let registration;
  let signedBatches;
  let validatorsc;
  let owner;
  let chain1;
  let chain2;
  let validatorClaimsBRC;
  let validatorClaimsBEC;
  let signedBatch;
  let validatorAddressChainData;
  let validators;
  let mockPrecompileFalse;
  let connection;
  let provider;
  let fixture;
  let ethers;

  beforeEach(async function () {
    fixture = await deployBridgeFixture(hre);

    bridge = fixture.bridge;
    claimsHelper = fixture.claimsHelper;
    claims = fixture.claims;
    chainTokens = fixture.chainTokens;
    registration = fixture.registration;
    signedBatches = fixture.signedBatches;
    validatorsc = fixture.validatorsc;
    owner = fixture.owner;
    chain1 = fixture.chain1;
    chain2 = fixture.chain2;
    validatorClaimsBRC = fixture.validatorClaimsBRC;
    validatorClaimsBEC = fixture.validatorClaimsBEC;
    signedBatch = fixture.signedBatch;
    validatorAddressChainData = fixture.validatorAddressChainData;
    validators = fixture.validators;
    mockPrecompileFalse = fixture.mockPrecompileFalse;
    connection = fixture.connection;
    provider = fixture.provider;
    ethers = fixture.ethers;

    // Register chains
    await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
    await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
  });

  async function hasVotedClaims(hash, _addr) {
    // bitmap(...) returns bigint in ethers v6
    const validatorIndex = (await validatorsc.getValidatorIndex(_addr)) - 1n;
    const bitmap = await claimsHelper.bitmap(hash);

    return (bitmap & (1n << BigInt(validatorIndex))) !== 0n;
  }

  async function hasVotedSignedBatches(hash, addr) {
    // 1) get validator index exactly like contract does
    const validatorIdxRaw = await validatorsc.getValidatorIndex(addr);

    const validatorIdx = BigInt(validatorIdxRaw); // convert to bigint

    if (validatorIdx === 0n) {
      return false; // not validator, same as Solidity
    }

    const bitmap = await signedBatches.votes(hash); // returns bigint directly now

    const bit = 1n << (validatorIdx - 1n);
    return (bitmap & bit) !== 0n;
  }
});
