import hre from "hardhat";
import { expect } from "chai";
import { TransactionType, deployBridgeFixture } from "./fixtures";

describe("Redistribute Tokens", function () {
  it("Should revert if token redistribution is not sent by owner", async function () {
    await expect(admin.connect(validators[0]).redistributeBridgingAddrsTokens(chain1.id)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  it("Should revert on Claims if redistribution is not called by Bridge", async function () {
    await expect(claims.connect(validators[0]).createRedistributeTokensTx(chain1.id)).to.be.revertedWithCustomError(
      claims,
      "NotAdminContract"
    );
  });

  it("Should increase last confirmed tx nonce when redistribution transaction is added", async function () {
    expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(0);

    await admin.connect(owner).redistributeBridgingAddrsTokens(chain1.id);

    expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(1);

    const confirmedTxs = await claims.connect(owner).confirmedTransactions(chain1.id, 1);

    const blockNum = await claims.nextTimeoutBlock(chain1.id);

    expect(confirmedTxs.nonce).to.equal(1);
    expect(confirmedTxs.transactionType).to.equal(TransactionType.REDISTRIBUTION);
    expect(confirmedTxs.blockHeight).to.be.lessThan(blockNum);
    expect(confirmedTxs.retryCounter).to.equal(0);
    expect(confirmedTxs.destinationChainId).to.equal(chain1.id);
  });

  it("Should update next timeout when redistribution transaction is added", async function () {
    await admin.connect(owner).redistributeBridgingAddrsTokens(chain1.id);

    await expect(bridge.connect(owner).getConfirmedTransactions(chain1.id)).to.be.revertedWithCustomError(
      claims,
      "CanNotCreateBatchYet"
    );

    // wait for next timeout
    for (let i = 0; i < 9; i++) {
      await connection.ethers.provider.send("evm_mine");
    }

    const confirmedTxs = await bridge.connect(owner).getConfirmedTransactions(chain1.id);

    const blockNum = await claims.nextTimeoutBlock(chain1.id);

    expect(confirmedTxs.length).to.equal(1);
    expect(confirmedTxs[0].nonce).to.equal(1);
    expect(confirmedTxs[0].transactionType).to.equal(TransactionType.REDISTRIBUTION);
    expect(confirmedTxs[0].blockHeight).to.be.lessThan(blockNum);
    expect(confirmedTxs[0].retryCounter).to.equal(0);
    expect(confirmedTxs[0].destinationChainId).to.equal(chain1.id);
  });

  it("Should not create batch when redistribution is in progress", async function () {
    const signedBatchStakeDelOrRedistr = structuredClone(signedBatch);
    signedBatchStakeDelOrRedistr.destinationChainId = 1;

    await admin.connect(owner).redistributeBridgingAddrsTokens(chain1.id);

    // wait for next timeout
    for (let i = 0; i < 10; i++) {
      await connection.ethers.provider.send("evm_mine");
    }
    expect(await claims.shouldCreateBatch(chain1.id)).to.be.true;

    for (const v of validators.slice(0, 4)) {
      await bridge.connect(v).submitSignedBatch(signedBatchStakeDelOrRedistr);
    }

    expect(await claims.shouldCreateBatch(chain1.id)).to.be.false;
  });

  let admin;
  let bridge;
  let claims;
  let owner;
  let chain1;
  let chain2;
  let signedBatch;
  let validatorAddressChainData;
  let validators;
  let connection;
  let fixture;

  beforeEach(async function () {
    fixture = await deployBridgeFixture(hre);

    admin = fixture.admin;
    bridge = fixture.bridge;
    claims = fixture.claims;
    owner = fixture.owner;
    chain1 = fixture.chain1;
    chain2 = fixture.chain2;
    signedBatch = fixture.signedBatch;
    validatorAddressChainData = fixture.validatorAddressChainData;
    validators = fixture.validators;
    connection = fixture.connection;

    // Register chains
    await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
    await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
  });
});
