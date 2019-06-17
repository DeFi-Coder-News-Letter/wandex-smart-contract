require('../utils/hooks');

const assert = require('assert');
const Hydro = artifacts.require('./Hydro.sol');
const HydroToken = artifacts.require('./HydroToken.sol');

contract('Discount', accounts => {
    let hydro, hot;

    before(async () => {
        hydro = await Hydro.deployed();
        hot = await HydroToken.deployed();
    });

    it('can get hot address', async () => {
        assert.equal(await hydro.getHydroTokenAddress(), hot.address);
    });

    it('can change discount', async () => {
        await hydro.changeDiscountConfig(
            '0x040a000027106400004e205a000075305000009c404600000000000000000000',
            { from: accounts[0] }
        );

        // hot contract is deployed by accounts 0, so this account has many tokens.
        const res = await hydro.getDiscountedRate(accounts[0]);
        assert.equal('10', res);
    });

    it('should have discount', async () => {
        let res = await hydro.getDiscountedRate(accounts[0]);
        assert.equal(res.toString(), '60');

        res = await hydro.getDiscountedRate(accounts[1]);
        assert.equal('100', res);
    });

    it('cannot change discount without permissions', async () => {
        await assert.rejects(
            hydro.changeDiscountConfig(
                '0x040a000027106400004e205a000075305000009c404600000000000000000000',
                { from: accounts[1] }
            ),
            /NOT_OWNER/
        );
    });
});
