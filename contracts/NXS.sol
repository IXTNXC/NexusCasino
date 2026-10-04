// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * NEXUS (NXS) - token ERC-20 de suministro fijo.
 *
 * Decisiones de seguridad deliberadas:
 *  - Todo el suministro se crea UNA sola vez en el constructor. No existe función mint,
 *    así que nadie (ni tú) puede crear más tokens después.
 *  - Sin owner, sin pausa, sin lista negra, sin impuestos de transferencia: menos código =
 *    menos superficie de ataque y más confianza para los usuarios.
 *  - Quemable (burn) para poder reducir el suministro si algún día quieres.
 *  - Permit (EIP-2612) para aprobaciones sin gas.
 *
 * Antes de lanzarlo con valor real, haz que lo revise un auditor.
 */
contract NXS is ERC20, ERC20Burnable, ERC20Permit {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18; // 1.000 millones NXS

    constructor(address initialHolder) ERC20("Nexus", "NXS") ERC20Permit("Nexus") {
        require(initialHolder != address(0), "holder = 0");
        _mint(initialHolder, TOTAL_SUPPLY);
    }
}
