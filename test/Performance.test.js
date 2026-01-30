import hre from "hardhat";
import { deployBridgeFixture } from "./fixtures";

describe("Performance", function () {
  it("submitClaims BRC", async function () {
    for (let i = 0; i < validators.length; i++) {
      // fourth one is quorum
      const tx = await bridge.connect(validators[i]).submitClaims(validatorClaimsBRC);
      const receipt = await tx.wait();
      console.log(`Gas spent for BRC on (${i}): ${!!receipt ? receipt.gasUsed.toString() : "error"}`);
    }
  });

  it("submitClaims BEC", async function () {
    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

    // wait for next timeout
    for (let i = 0; i < 8; i++) {
      await connection.ethers.provider.send("evm_mine");
    }

    for (let i = 0; i < (validators.length * 2) / 3 + 1; i++) {
      await bridge.connect(validators[i]).submitSignedBatch(signedBatch);
    }

    // wait for next timeout
    for (let i = 0; i < 8; i++) {
      await connection.ethers.provider.send("evm_mine");
    }

    for (let i = 0; i < validators.length; i++) {
      // fourth one is quorum
      const tx = await bridge.connect(validators[i]).submitClaims(validatorClaimsBEC);
      const receipt = await tx.wait();
      console.log(`Gas spent for BEC on (${i}): ${!!receipt ? receipt.gasUsed.toString() : "error"}`);
    }
  });

  it("submitClaims BEFC", async function () {
    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

    // wait for next timeout
    for (let i = 0; i < 8; i++) {
      await connection.ethers.provider.send("evm_mine");
    }

    for (let i = 0; i < (validators.length * 2) / 3 + 1; i++) {
      await bridge.connect(validators[i]).submitSignedBatch(signedBatch);
    }

    // wait for next timeout
    for (let i = 0; i < 8; i++) {
      await connection.ethers.provider.send("evm_mine");
    }

    for (let i = 0; i < validators.length; i++) {
      // fourth one is quorum
      const tx = await bridge.connect(validators[i]).submitClaims(validatorClaimsBEFC);
      const receipt = await tx.wait();
      console.log(`Gas spent for BEFC on (${i}): ${!!receipt ? receipt.gasUsed.toString() : "error"}`);
    }
  });

  it("submitClaims RRC", async function () {
    for (let i = 0; i < validators.length; i++) {
      // fourth one is quorum
      const tx = await bridge.connect(validators[i]).submitClaims(validatorClaimsRRC);
      const receipt = await tx.wait();
      console.log(`Gas spent for RRC on (${i}): ${!!receipt ? receipt.gasUsed.toString() : "error"}`);
    }
  });

  it("submitClaims HWIC", async function () {
    for (let i = 0; i < validators.length; i++) {
      // fourth one is quorum
      const tx = await bridge.connect(validators[i]).submitClaims(validatorClaimsHWIC);
      const receipt = await tx.wait();
      console.log(`Gas spent for HWIC on (${i}): ${!!receipt ? receipt.gasUsed.toString() : "error"}`);
    }
  });

  it("submitSignedBatch", async function () {
    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

    // wait for next timeout
    for (let i = 0; i < 8; i++) {
      await connection.ethers.provider.send("evm_mine");
    }

    for (let i = 0; i < validators.length; i++) {
      // fourth one is quorum
      const tx = await bridge.connect(validators[i]).submitSignedBatch(signedBatch);
      const receipt = await tx.wait();
      console.log(`Gas spent for SignerBatch on (${i}): ${!!receipt ? receipt.gasUsed.toString() : "error"}`);
    }
  });

  let bridge;
  let owner;
  let chain1;
  let chain2;
  let validatorClaimsBRC;
  let validatorClaimsBEC;
  let validatorClaimsBEFC;
  let validatorClaimsRRC;
  let validatorClaimsHWIC;
  let signedBatch;
  let validatorAddressChainData;
  let validators;
  let connection;
  let fixture;

  beforeEach(async function () {
    fixture = await deployBridgeFixture(hre);

    bridge = fixture.bridge;
    owner = fixture.owner;
    chain1 = fixture.chain1;
    chain2 = fixture.chain2;
    validatorClaimsBRC = fixture.validatorClaimsBRC;
    validatorClaimsBEC = fixture.validatorClaimsBEC;
    validatorClaimsBEFC = fixture.validatorClaimsBEFC;
    validatorClaimsRRC = fixture.validatorClaimsRRC;
    validatorClaimsHWIC = fixture.validatorClaimsHWIC;
    signedBatch = fixture.signedBatch;
    validatorAddressChainData = fixture.validatorAddressChainData;
    validators = fixture.validators;
    connection = fixture.connection;

    // Register chains
    await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
    await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
  });
});
