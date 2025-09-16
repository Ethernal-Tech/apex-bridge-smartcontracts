import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";

describe("Bridging Addresses", function () {
    it("Should revert if init bridging addresses is not sent by upgrade admin", async function () {
        const { bridge, validators, bridgingAddresses } = await loadFixture(deployBridgeFixture);

        await expect(bridge.connect(validators[0]).setBridgingAddrsDependencyAndSync(bridgingAddresses.target))
            .to.be.revertedWithCustomError(bridge, "NotOwner");
    });

    it("Should revert if set bridging addresses count is not sent by owner", async function () {
        const { admin, chain1, validators } = await loadFixture(deployBridgeFixture);

        await expect(admin.connect(validators[0]).updateBridgingAddrsCount(chain1.id, 5, 5))
            .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should initialize registered chains on bridging addresses", async function () {
        const { owner, validatorAddressChainData, bridge, bridgingAddresses, chain1, chain2 } = await loadFixture(deployBridgeFixture);

        expect(await bridgingAddresses.connect(owner).bridgingAddressesCount(chain1.id)).to.equal(0);
        expect(await bridgingAddresses.connect(owner).bridgingAddressesCount(chain2.id)).to.equal(0);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        await bridge.connect(owner).registerChain(chain2, 10000, 10000, validatorAddressChainData);

        expect(await bridgingAddresses.connect(owner).bridgingAddressesCount(chain1.id)).to.equal(1);
        expect(await bridgingAddresses.connect(owner).bridgingAddressesCount(chain2.id)).to.equal(1);

        expect(await bridgingAddresses.connect(owner).stakeBridgingAddrsCount(chain1.id)).to.equal(0);
        expect(await bridgingAddresses.connect(owner).stakeBridgingAddrsCount(chain2.id)).to.equal(0);
    });

    it("Should initialize chains registered with governance on bridging addresses", async function () {
        const { validatorAddressChainData, bridge, bridgingAddresses, chain1, validators } = await loadFixture(deployBridgeFixture);

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
        expect(await bridgingAddresses.connect(validators[0]).stakeBridgingAddrsCount(chain1.id)).to.equal(0);
    });

    it("Should revert when bridging address count is initialized twice", async function () {
        const { owner, validatorAddressChainData, bridge, bridgingAddresses, chain1 } = await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        expect(await bridgingAddresses.connect(owner).bridgingAddressesCount(chain1.id)).to.equal(1);
        expect(await bridgingAddresses.connect(owner).stakeBridgingAddrsCount(chain1.id)).to.equal(0);

        await expect(bridge.connect(owner).setBridgingAddrsDependencyAndSync(bridgingAddresses.target))
            .to.be.revertedWithCustomError(bridge, "BridgingAddrCountAlreadyInit");
    });

    it("Should update bridging address count", async function () {
        const { owner, validatorAddressChainData, bridge, admin, bridgingAddresses, chain1 } = await loadFixture(deployBridgeFixture);
        const bridgingAddrCount = 10;
        const stakeBridgingAddrCount = 5;

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        expect(await bridgingAddresses.connect(owner).bridgingAddressesCount(chain1.id)).to.equal(1);
        expect(await bridgingAddresses.connect(owner).stakeBridgingAddrsCount(chain1.id)).to.equal(0);

        await admin.connect(owner).updateBridgingAddrsCount(chain1.id, bridgingAddrCount, stakeBridgingAddrCount);
        expect(await bridgingAddresses.connect(owner).bridgingAddressesCount(chain1.id)).to.equal(bridgingAddrCount);
        expect(await bridgingAddresses.connect(owner).stakeBridgingAddrsCount(chain1.id)).to.equal(stakeBridgingAddrCount);
    });

    it("Should revert when updating bridging address count for non-registered chain", async function () {
        const { owner, admin, chain1 } = await loadFixture(deployBridgeFixture);

        await expect(admin.connect(owner).updateBridgingAddrsCount(chain1.id, 10, 5))
            .to.be.revertedWithCustomError(admin, "ChainIsNotRegistered");
    });

    it("Should revert when updating bridging address count to zero", async function () {
        const { owner, bridge, admin, bridgingAddresses, chain1, validatorAddressChainData } = await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        expect(await bridgingAddresses.connect(owner).bridgingAddressesCount(chain1.id)).to.equal(1);
        expect(await bridgingAddresses.connect(owner).stakeBridgingAddrsCount(chain1.id)).to.equal(0);

        await expect(admin.connect(owner).updateBridgingAddrsCount(chain1.id, 0, 1))
            .to.be.revertedWithCustomError(bridge, "InvalidBridgingAddrCount");
    });

    it("Should be possible to set stake bridging address count to zero", async function () {
        const { owner, validatorAddressChainData, bridge, admin, bridgingAddresses, chain1 } = await loadFixture(deployBridgeFixture);
        const bridgingAddrCount = 10;
        const stakeBridgingAddrCount = 0;

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        expect(await bridgingAddresses.connect(owner).bridgingAddressesCount(chain1.id)).to.equal(1);
        expect(await bridgingAddresses.connect(owner).stakeBridgingAddrsCount(chain1.id)).to.equal(0);

        await admin.connect(owner).updateBridgingAddrsCount(chain1.id, bridgingAddrCount, stakeBridgingAddrCount);
        expect(await bridgingAddresses.connect(owner).bridgingAddressesCount(chain1.id)).to.equal(bridgingAddrCount);
        expect(await bridgingAddresses.connect(owner).stakeBridgingAddrsCount(chain1.id)).to.equal(stakeBridgingAddrCount);
    });
});