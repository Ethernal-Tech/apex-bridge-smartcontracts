import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";

describe("Bridging Addresses", function () {
  it("Should revert if init bridging addresses is not sent by upgrade admin", async function () {
    await expect(
      bridge
        .connect(validators[0])
        .setAdditionalDependenciesAndSync(
          bridgingAddresses.target,
          chainTokens.target,
          claimsHelper.target,
          registration.target,
          true
        )
    ).to.be.revertedWithCustomError(bridge, "NotUpgradeAdmin");
  });

  it("Should revert if set bridging addresses count is not sent by owner", async function () {
    await expect(admin.connect(validators[0]).updateBridgingAddrsCount(chain1.id, 5)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  it("Should initialize registered chains on bridging addresses", async function () {
    expect(await bridgingAddresses.connect(owner).bridgingAddressesCount(chain1.id)).to.equal(0);
    expect(await bridgingAddresses.connect(owner).bridgingAddressesCount(chain2.id)).to.equal(0);

    await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
    await bridge.connect(owner).registerChain(chain2, 10000, 10000, validatorAddressChainData);

    expect(await bridgingAddresses.connect(owner).bridgingAddressesCount(chain1.id)).to.equal(1);
    expect(await bridgingAddresses.connect(owner).bridgingAddressesCount(chain2.id)).to.equal(1);
  });

  it("Should initialize chains registered with governance on bridging addresses", async function () {
    expect(await bridgingAddresses.connect(validators[0]).bridgingAddressesCount(chain1.id)).to.equal(0);

    await bridge
      .connect(validators[0])
      .registerChainGovernance(
        chain1.id,
        chain1.chainType,
        100,
        100,
        validatorAddressChainData[0].data,
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000"
      );
    await bridge
      .connect(validators[1])
      .registerChainGovernance(
        chain1.id,
        chain1.chainType,
        100,
        100,
        validatorAddressChainData[1].data,
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000"
      );
    await bridge
      .connect(validators[2])
      .registerChainGovernance(
        chain1.id,
        chain1.chainType,
        100,
        100,
        validatorAddressChainData[2].data,
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000"
      );
    await bridge
      .connect(validators[3])
      .registerChainGovernance(
        chain1.id,
        chain1.chainType,
        100,
        100,
        validatorAddressChainData[3].data,
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000"
      );
    await bridge
      .connect(validators[4])
      .registerChainGovernance(
        chain1.id,
        chain1.chainType,
        100,
        100,
        validatorAddressChainData[4].data,
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000"
      );

    expect(await bridgingAddresses.connect(validators[0]).bridgingAddressesCount(chain1.id)).to.equal(1);
  });

  it("Should update bridging address count", async function () {
    const bridgingAddrCount = 10;

    await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
    expect(await bridgingAddresses.connect(owner).bridgingAddressesCount(chain1.id)).to.equal(1);

    await admin.connect(owner).updateBridgingAddrsCount(chain1.id, bridgingAddrCount);
    expect(await bridgingAddresses.connect(owner).bridgingAddressesCount(chain1.id)).to.equal(bridgingAddrCount);
  });

  it("Should revert when updating bridging address count for non-registered chain", async function () {
    const bridgingAddrCount = 10;

    await expect(
      admin.connect(owner).updateBridgingAddrsCount(chain1.id, bridgingAddrCount)
    ).to.be.revertedWithCustomError(admin, "ChainIsNotRegistered");
  });

  it("Should revert when updating bridging address count to zero", async function () {
    await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
    expect(await bridgingAddresses.connect(owner).bridgingAddressesCount(chain1.id)).to.equal(1);

    await expect(admin.connect(owner).updateBridgingAddrsCount(chain1.id, 0)).to.be.revertedWithCustomError(
      bridge,
      "InvalidBridgingAddrCount"
    );
  });

  let admin: any;
  let bridge: any;
  let bridgingAddresses: any;
  let chainTokens: any;
  let claimsHelper: any;
  let registration: any;
  let owner: any;
  let chain1: any;
  let chain2: any;
  let validatorAddressChainData: any;
  let validators: any;

  beforeEach(async function () {
    const fixture = await loadFixture(deployBridgeFixture);

    admin = fixture.admin;
    bridge = fixture.bridge;
    bridgingAddresses = fixture.bridgingAddresses;
    chainTokens = fixture.chainTokens;
    claimsHelper = fixture.claimsHelper;
    registration = fixture.registration;
    owner = fixture.owner;
    chain1 = fixture.chain1;
    chain2 = fixture.chain2;
    validatorAddressChainData = fixture.validatorAddressChainData;
    validators = fixture.validators;
  });
});
