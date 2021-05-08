pragma solidity ^0.6.2;
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract TokenVesting is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public token;
    uint256 public constant MAX_INITIAL_RELEASE = 1e8; // 6 decimals precision

    struct Vesting {
        uint256 begin;
        uint256 end;
        uint256 amount;
        uint256 immediateRelease;
        uint256 claimed;
    }
    mapping(address => Vesting[]) public vestings;

    struct AccountInfo {
        // If a particular account is compromised, we might need to remove their vestings
        bool isRevoked;
        // following fields are not strictly required, just to show data on front-end
        uint256 total;
        uint256 claimed;
    }
    mapping(address => AccountInfo) public info;

    event VestingAdded(address indexed beneficiary, uint256 indexed amount);
    event Claimed(address indexed beneficiary, uint256 indexed amount);

    constructor(IERC20 _token) public {
        token = _token;
    }

    function addVestings(
        address[] calldata beneficiary,
        uint256[] calldata amount,
        uint256 begin,
        uint256 end,
        uint256 immediateRelease
    ) external onlyOwner {
        require(beneficiary.length == amount.length, "Invalid Input");
        for (uint256 i = 0; i < beneficiary.length; i++) {
            _addVesting(beneficiary[i], begin, end, amount[i], immediateRelease);
        }
    }

    function addCustomizedVestings(
        address[] calldata beneficiary,
        uint256[] calldata amount,
        uint256[] calldata begin,
        uint256[] calldata end,
        uint256[] calldata immediateRelease
    ) external onlyOwner {
        require(
            beneficiary.length == begin.length &&
                beneficiary.length == end.length &&
                beneficiary.length == amount.length &&
                beneficiary.length == immediateRelease.length,
            "Invalid Input"
        );
        for (uint256 i = 0; i < beneficiary.length; i++) {
            _addVesting(beneficiary[i], begin[i], end[i], amount[i], immediateRelease[i]);
        }
    }

    function _addVesting(
        address beneficiary,
        uint256 begin,
        uint256 end,
        uint256 amount,
        uint256 immediateRelease
    ) internal {
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

    function claim() external returns (uint256 total) {
        address beneficiary = msg.sender;
        require(!info[beneficiary].isRevoked, "beneficiary is revoked");

        uint256 _now = _timestamp();
        uint256 amount;

        // A single address is not expected to have more than 36 vestings, so this loop should be fine
        for (uint256 i = 0; i < vestings[beneficiary].length; i++) {
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

    function claimable(address beneficiary) external view returns (uint256 total) {
        if (info[beneficiary].isRevoked) {
            return 0;
        }

        uint256 _now = _timestamp();
        for (uint256 i = 0; i < vestings[beneficiary].length; i++) {
            total = total.add(_releasable(vestings[beneficiary][i], _now));
        }
    }

    function _releasable(Vesting memory vesting, uint256 _now) internal pure returns (uint256) {
        if (_now < vesting.begin) {
            // Vesting hasn't begun at all
            return 0;
        }

        uint256 vested;
        if (_now >= vesting.end) {
            // The entire amount has vested
            vested = vesting.amount;
        } else {
            // Vest immediateRelease and the rest as a proportion of time elapsed
            uint256 vestingDuration = vesting.end.sub(vesting.begin);
            uint256 elapsed = _now.sub(vesting.begin);
            vested = vesting
                .amount
                .mul(
                vesting.immediateRelease.add(
                    MAX_INITIAL_RELEASE.sub(vesting.immediateRelease).mul(elapsed).div(vestingDuration)
                )
            )
                .div(MAX_INITIAL_RELEASE);
        }

        return vested.sub(vesting.claimed);
    }

    function _timestamp() internal view returns (uint256) {
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
    function seize(IERC20 _token, uint256 amount) external onlyOwner {
        _token.safeTransfer(msg.sender, amount);
    }
}
