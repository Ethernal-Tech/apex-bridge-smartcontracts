import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers } from "hardhat";
import { deployBridgeFixture } from "./fixtures";

describe("Performance", function () {
  it("registerChain", async function () {
    const { bridge, chain1, owner, validatorAddressChainData } = await loadFixture(deployBridgeFixture);

    const tx = await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
    const receipt = await tx.wait();
    console.log(`Gas spent: ${!!receipt ? receipt.gasUsed.toString() : "error"}`);
  });

  it("registerChainGovernance", async function () {
    const { bridge, chain1, validators, validatorCardanoData } = await loadFixture(deployBridgeFixture);

    for (let i = 0; i < (validators.length * 2) / 3 + 1; i++) {
      // fourth one is quorum
      const tx = await bridge
        .connect(validators[i])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorCardanoData,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      const receipt = await tx.wait();
      console.log(`Gas spent on (${i}): ${!!receipt ? receipt.gasUsed.toString() : "error"}`);
    }
  });

  it("submitClaims BRC", async function () {
    const { bridge, chain1, chain2, validators, validatorClaimsBRC, validatorAddressChainData, owner } =
      await loadFixture(deployBridgeFixture);

    await bridge.connect(owner).registerChain(chain1, 10000, validatorAddressChainData);
    await bridge.connect(owner).registerChain(chain2, 10000, validatorAddressChainData);

    for (let i = 0; i < validators.length; i++) {
      // fourth one is quorum
      const tx = await bridge.connect(validators[i]).submitClaims(validatorClaimsBRC);
      const receipt = await tx.wait();
      console.log(`Gas spent on (${i}): ${!!receipt ? receipt.gasUsed.toString() : "error"}`);
    }
  });

  it("submitSignedBatch", async function () {
    const { bridge, chain1, chain2, owner, validators, validatorClaimsBRC, signedBatch, validatorAddressChainData } =
      await loadFixture(deployBridgeFixture);

    await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
    await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

    // wait for next timeout
    for (let i = 0; i < 3; i++) {
      await ethers.provider.send("evm_mine");
    }

    for (let i = 0; i < validators.length; i++) {
      // fourth one is quorum
      const tx = await bridge.connect(validators[i]).submitSignedBatch(signedBatch);
      const receipt = await tx.wait();
      console.log(`Gas spent on (${i}): ${!!receipt ? receipt.gasUsed.toString() : "error"}`);
    }
  });

  it("submitClaims BEC", async function () {
    const {
      bridge,
      chain1,
      chain2,
      owner,
      validators,
      validatorClaimsBRC,
      signedBatch,
      validatorAddressChainData,
      validatorClaimsBEC,
    } = await loadFixture(deployBridgeFixture);

    await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
    await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

    // wait for next timeout
    for (let i = 0; i < 3; i++) {
      await ethers.provider.send("evm_mine");
    }

    for (let i = 0; i < (validators.length * 2) / 3 + 1; i++) {
      await bridge.connect(validators[i]).submitSignedBatch(signedBatch);
    }

    // wait for next timeout
    for (let i = 0; i < 3; i++) {
      await ethers.provider.send("evm_mine");
    }

    for (let i = 0; i < validators.length; i++) {
      // fourth one is quorum
      const tx = await bridge.connect(validators[i]).submitClaims(validatorClaimsBEC);
      const receipt = await tx.wait();
      console.log(`Gas spent on (${i}): ${!!receipt ? receipt.gasUsed.toString() : "error"}`);
    }
  });

  it("submitClaims RRC", async function () {
    const { bridge, owner, validators, chain2, validatorClaimsRRC, validatorAddressChainData } = await loadFixture(
      deployBridgeFixture
    );

    await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

    for (let i = 0; i < validators.length; i++) {
      // fourth one is quorum
      const tx = await bridge.connect(validators[i]).submitClaims(validatorClaimsRRC);
      const receipt = await tx.wait();
      console.log(`Gas spent on (${i}): ${!!receipt ? receipt.gasUsed.toString() : "error"}`);
    }
  });
});
