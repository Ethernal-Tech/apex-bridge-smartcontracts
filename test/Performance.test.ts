import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers } from "hardhat";
import { deployBridgeFixture } from "./fixtures";

describe("Performance", function () {
  it("registerChain", async function () {
    const { bridge, chain1, owner, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

    const tx = await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
    const receipt = await tx.wait();
    console.log("Gas spent: " + parseInt(receipt.gasUsed));
  });

  it("registerChainGovernance", async function () {
    const { bridge, chain1, validators, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

    const tx = await bridge.connect(validators[0]).registerChainGovernance(chain1, 100, validatorsCardanoData[0].data);
    const receipt = await tx.wait();
    console.log("Gas spent: " + parseInt(receipt.gasUsed));
  });

  it("submitClaims BRC", async function () {
    const { bridge, chain1, chain2, validators, validatorClaimsBRC, validatorsCardanoData, owner } = await loadFixture(
      deployBridgeFixture
    );

    await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
    await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);

    const tx = await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    const receipt = await tx.wait();
    console.log("Gas spent: " + parseInt(receipt.gasUsed));
  });

  it("submitSignedBatch", async function () {
    const { bridge, chain1, chain2, owner, validators, validatorClaimsBRC, signedBatch, validatorsCardanoData } =
      await loadFixture(deployBridgeFixture);

    await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
    await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

    // wait for next timeout
    for (let i = 0; i < 3; i++) {
      await ethers.provider.send("evm_mine");
    }

    const tx = await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
    const receipt = await tx.wait();
    console.log("Gas spent: " + parseInt(receipt.gasUsed));
  });

  it("submitClaims RRC", async function () {
    const { bridge, owner, validators, chain2, validatorClaimsRRC, validatorsCardanoData } = await loadFixture(
      deployBridgeFixture
    );

    await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

    const tx = await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
    const receipt = await tx.wait();
    console.log("Gas spent: " + parseInt(receipt.gasUsed));
  });

  it("submitClaims REC", async function () {
    const { bridge, owner, validators, chain2, validatorClaimsREC, validatorsCardanoData } = await loadFixture(
      deployBridgeFixture
    );

    await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

    const tx = await bridge.connect(validators[0]).submitClaims(validatorClaimsREC);
    const receipt = await tx.wait();
    console.log("Gas spent: " + parseInt(receipt.gasUsed));
  });
});
