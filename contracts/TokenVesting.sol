pragma solidity ^0.6.2;
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract TokenVesting is Ownable {
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    IERC20 public token;
    uint public constant MAX_INITIAL_RELEASE = 1e8; // 6 decimals precision

    struct Vesting {
        uint begin;
        uint end;
        uint amount;
        uint immediateRelease;
        uint claimed;
    }
    mapping (address => Vesting[]) public vestings;

    struct AccountInfo {
        // If a particular account is compromised, we might need to remove their vestings
        bool isRevoked;
        // following fields are not strictly required, just to show data on front-end
        uint total;
        uint claimed;
    }
    mapping (address => AccountInfo) public info;

    event VestingAdded(address indexed beneficiary, uint indexed amount);
    event Claimed(address indexed beneficiary, uint indexed amount);

    constructor (IERC20 _token) public {
        token = _token;
    }

    function addVestings(
        address[] calldata beneficiary,
        uint[] calldata amount,
        uint begin,
        uint end,
        uint immediateRelease
    )
        external
        onlyOwner
    {
        require(
            beneficiary.length == amount.length,
            "Invalid Input"
        );
        for (uint i = 0; i < beneficiary.length; i++) {
            _addVesting(beneficiary[i], begin, end, amount[i], immediateRelease);
        }
    }

    function addCustomizedVestings(
        address[] calldata beneficiary,
        uint[] calldata amount,
        uint[] calldata begin,
        uint[] calldata end,
        uint[] calldata immediateRelease
    )
        external
        onlyOwner
    {
        require(
            beneficiary.length == begin.length
            && beneficiary.length == end.length
            && beneficiary.length == amount.length
            && beneficiary.length == immediateRelease.length,
            "Invalid Input"
        );
        for (uint i = 0; i < beneficiary.length; i++) {
            _addVesting(beneficiary[i], begin[i], end[i], amount[i], immediateRelease[i]);
        }
    }

    function _addVesting(address beneficiary, uint begin, uint end, uint amount, uint immediateRelease)
        internal
    {
        require(beneficiary != address(0x0), "beneficiary=0");
        require(end > begin, "invalid range");
        require(amount > 0, "amount=0");
        immediateRelease = immediateRelease.mul(1e6); // 6 decimals precision
        require(immediateRelease <= MAX_INITIAL_RELEASE, "immediateRelease > MAX_INITIAL_RELEASE");

        AccountInfo storage _info = info[beneficiary];
        require(!_info.isRevoked, "beneficiary is revoked");
        require(vestings[beneficiary].length < 36, "Too many vestings");
        vestings[beneficiary].push(Vesting(begin, end, amount, immediateRelease, 0));
        _info.total = _info.total.add(amount);

        emit VestingAdded(beneficiary, amount);
    }

    function claim() external returns (uint total) {
        address beneficiary = msg.sender;
        require(!info[beneficiary].isRevoked, "beneficiary is revoked");

        uint _now = _timestamp();
        uint amount;

        // A single address is not expected to have more than 36 vestings, so this loop should be fine
        for (uint i = 0; i < vestings[beneficiary].length; i++) {
            amount = _releasable(vestings[beneficiary][i], _now);
            if (amount > 0) {
                vestings[beneficiary][i].claimed = vestings[beneficiary][i].claimed.add(amount);
                total = total.add(amount);
            }
        }

        if (total > 0) {
            info[beneficiary].claimed = info[beneficiary].claimed.add(total);
            token.safeTransfer(beneficiary, total);
            emit Claimed(beneficiary, total);
        }
    }

    function claimable(address beneficiary) external view returns (uint total) {
        if (info[beneficiary].isRevoked) {
            return 0;
        }

        uint _now = _timestamp();
        for (uint i = 0; i < vestings[beneficiary].length; i++) {
            total = total.add(
                _releasable(vestings[beneficiary][i], _now)
            );
        }
    }

    function _releasable(Vesting memory vesting, uint _now) internal pure returns(uint) {
        if (_now < vesting.begin) { // Vesting hasn't begun at all
            return 0;
        }

        uint vested;
        if (_now >= vesting.end) { // The entire amount has vested
            vested = vesting.amount;
        } else {
            // Vest immediateRelease and the rest as a proportion of time elapsed
            uint vestingDuration = vesting.end.sub(vesting.begin);
            uint elapsed = _now.sub(vesting.begin);
            vested = vesting.amount.mul(vesting.immediateRelease.add(MAX_INITIAL_RELEASE.sub(vesting.immediateRelease).mul(elapsed)
                       .div(vestingDuration)
                    )
                )
                .div(MAX_INITIAL_RELEASE);
        }

        return vested.sub(vesting.claimed);
    }

    function _timestamp() internal view returns (uint) {
        return block.timestamp;
    }

    /* Admin Maintenance Functions */

    function toggleRevoked(address beneficiary) external onlyOwner {
        AccountInfo storage _info = info[beneficiary];
        if (!_info.isRevoked) {
            _info.isRevoked = true;
        } else {
            _info.isRevoked = false;
        }
    }

    /// @notice Emergency Withdrawl
    function seize(IERC20 _token, uint amount) external onlyOwner {
        _token.safeTransfer(msg.sender, amount);
    }
}