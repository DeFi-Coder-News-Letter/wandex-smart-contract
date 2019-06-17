require('../utils/hooks');
const assert = require('assert');
const Hydro = artifacts.require('./Hydro.sol');
const { toWei } = require('../utils');
const { newMarket } = require('../utils/assets');

contract('Transfer', accounts => {
    let hydro;

    const etherAsset = '0x0000000000000000000000000000000000000000';
    const hugeAmount = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const user = accounts[0];

    const createMarket = () => {
        return newMarket({
            assetConfigs: [
                {
                    symbol: 'ETH',
                    name: 'ETH',
                    decimals: 18,
                    oraclePrice: toWei('100')
                },
                {
                    symbol: 'USD',
                    name: 'USD',
                    decimals: 18,
                    oraclePrice: toWei('1')
                }
            ]
        });
    };

    before(async () => {
        hydro = await Hydro.deployed();
    });

    it('deposit ether successfully', async () => {
        const balanceBefore = await hydro.balanceOf(etherAsset, user);

        await hydro.deposit(etherAsset, toWei('1'), { value: toWei('1') });
        const balanceAfter = await hydro.balanceOf(etherAsset, user);

        assert.equal(balanceAfter.sub(balanceBefore).toString(), toWei('1'));
    });

    it('deposit ether successfully (fallback function)', async () => {
        const balanceBefore = await hydro.balanceOf(etherAsset, user);

        await hydro.send(toWei('1'));
        const balanceAfter = await hydro.balanceOf(etherAsset, user);

        assert.equal(balanceAfter.sub(balanceBefore).toString(), toWei('1'));
    });

    it('deposit ether unsuccessfully', async () => {
        // msg value and amount not equal
        await assert.rejects(
            hydro.deposit(etherAsset, toWei('100'), { value: toWei('1') }),
            /MSG_VALUE_AND_AMOUNT_MISMATCH/
        );
    });

    it('deposit token successfully', async () => {
        const { quoteAsset } = await createMarket();

        const balanceBefore = await hydro.balanceOf(quoteAsset.address, user);
        assert.equal(balanceBefore.toString(), toWei('0'));

        // have to approve before
        await quoteAsset.approve(hydro.address, hugeAmount);

        await hydro.deposit(quoteAsset.address, toWei('1'));
        const balanceAfter = await hydro.balanceOf(quoteAsset.address, user);

        assert.equal(balanceAfter.sub(balanceBefore).toString(), toWei('1'));
    });

    it('deposit token unsuccessfully (no allowance)', async () => {
        const { quoteAsset } = await createMarket();

        // try to deposit hugeAmount
        await assert.rejects(
            hydro.deposit(quoteAsset.address, hugeAmount),
            /TOKEN_TRANSFER_FROM_ERROR/
        );
    });

    it('deposit token unsuccessfully (not enough balance)', async () => {
        const { quoteAsset } = await createMarket();

        // approve
        await quoteAsset.approve(hydro.address, hugeAmount);

        // try to deposit hugeAmount
        await assert.rejects(
            hydro.deposit(quoteAsset.address, hugeAmount),
            /TOKEN_TRANSFER_FROM_ERROR/
        );
    });

    it('withdraw ether successfully', async () => {
        // prepare
        await hydro.deposit(etherAsset, toWei('1'), { value: toWei('1') });
        const balanceBefore = await hydro.balanceOf(etherAsset, user);
        assert.equal(balanceBefore.toString(), toWei('1'));

        // test
        await hydro.withdraw(etherAsset, toWei('1'));
        const balanceAfter = await hydro.balanceOf(etherAsset, user);

        assert.equal(balanceAfter.toString(), toWei('0'));
    });

    it('withdraw ether unsuccessfully', async () => {
        // prepare
        await hydro.deposit(etherAsset, toWei('1'), { value: toWei('1') });
        const balanceBefore = await hydro.balanceOf(etherAsset, user);
        assert.equal(balanceBefore.toString(), toWei('1'));

        // try to withdraw more than owned amount
        await assert.rejects(hydro.withdraw(etherAsset, toWei('100')), /BALANCE_NOT_ENOUGH/);

        const balanceAfter = await hydro.balanceOf(etherAsset, user);
        assert.equal(balanceAfter.toString(), toWei('1'));
    });

    it('withdraw token successfully', async () => {
        // prepare
        const { quoteAsset } = await createMarket();
        await quoteAsset.approve(hydro.address, hugeAmount);
        await hydro.deposit(quoteAsset.address, toWei('1'));
        assert.equal(await hydro.balanceOf(quoteAsset.address, user), toWei('1'));

        // test
        await hydro.withdraw(quoteAsset.address, toWei('1'));
        assert.equal(await hydro.balanceOf(quoteAsset.address, user), toWei('0'));
    });

    it('withdraw token unsuccessfully', async () => {
        // prepare
        const { quoteAsset } = await createMarket();
        await quoteAsset.approve(hydro.address, hugeAmount);
        await hydro.deposit(quoteAsset.address, toWei('1'));
        assert.equal(await hydro.balanceOf(quoteAsset.address, user), toWei('1'));

        // test
        await assert.rejects(hydro.withdraw(quoteAsset.address, hugeAmount), /BALANCE_NOT_ENOUGH/);
        assert.equal(await hydro.balanceOf(quoteAsset.address, user), toWei('1'));
    });

    it('transfer ether successfully', async () => {
        // prepare
        await createMarket();

        await hydro.deposit(etherAsset, toWei('1'), { value: toWei('1') });
        const balanceBefore = await hydro.balanceOf(etherAsset, user);
        assert.equal(balanceBefore.toString(), toWei('1'));

        const marketBalanceBefore = await hydro.marketBalanceOf(0, etherAsset, user);
        assert.equal(marketBalanceBefore.toString(), toWei('0'));

        // test
        await hydro.transfer(
            etherAsset,
            {
                category: 0,
                marketID: 0,
                user: user
            },
            {
                category: 1,
                marketID: 0,
                user: user
            },
            toWei('1')
        );

        const balanceAfter = await hydro.balanceOf(etherAsset, user);
        assert.equal(balanceAfter.toString(), toWei('0'));

        const marketBalanceAfter = await hydro.marketBalanceOf(0, etherAsset, user);
        assert.equal(marketBalanceAfter.toString(), toWei('1'));
    });

    it('transfer ether unsuccessfully', async () => {
        const balanceBefore = await hydro.balanceOf(etherAsset, user);
        assert.equal(balanceBefore.toString(), toWei('0'));

        // user has insufficient balance
        await assert.rejects(
            hydro.transfer(
                etherAsset,
                {
                    category: 0,
                    marketID: 0,
                    user: user
                },
                {
                    category: 1,
                    marketID: 0,
                    user: user
                },
                toWei('1')
            ),
            /TRANSFER_BALANCE_NOT_ENOUGH/
        );
    });

    it('transfer token successfully', async () => {
        // prepare
        const { quoteAsset } = await createMarket();
        await quoteAsset.approve(hydro.address, hugeAmount);
        await hydro.deposit(quoteAsset.address, toWei('1'));

        assert.equal(await hydro.balanceOf(quoteAsset.address, user), toWei('1'));
        assert.equal(await hydro.marketBalanceOf(0, quoteAsset.address, user), toWei('0'));

        // test
        await hydro.transfer(
            quoteAsset.address,
            {
                category: 0,
                marketID: 0,
                user: user
            },
            {
                category: 1,
                marketID: 0,
                user: user
            },
            toWei('1')
        );

        assert.equal(await hydro.balanceOf(quoteAsset.address, user), toWei('0'));
        assert.equal(await hydro.marketBalanceOf(0, quoteAsset.address, user), toWei('1'));
    });

    it('transfer token unsuccessfully', async () => {
        // prepare
        const { quoteAsset } = await createMarket();
        await quoteAsset.approve(hydro.address, hugeAmount);
        await hydro.deposit(quoteAsset.address, toWei('1'));

        assert.equal(await hydro.balanceOf(quoteAsset.address, user), toWei('1'));
        assert.equal(await hydro.marketBalanceOf(0, quoteAsset.address, user), toWei('0'));

        // test
        await assert.rejects(
            hydro.transfer(
                quoteAsset.address,
                {
                    category: 0,
                    marketID: 0,
                    user: user
                },
                {
                    category: 1,
                    marketID: 0,
                    user: user
                },
                toWei('100')
            ),
            /TRANSFER_BALANCE_NOT_ENOUGH/
        );

        assert.equal(await hydro.balanceOf(quoteAsset.address, user), toWei('1'));
        assert.equal(await hydro.marketBalanceOf(0, quoteAsset.address, user), toWei('0'));
    });
});
