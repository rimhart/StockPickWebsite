from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List


@dataclass
class SectorAnalyst:
    tickers: List[str]
    macro_vibe: str
    squad_map: Dict[str, List[str]] = field(default_factory=lambda: {
        "energy": ["ADRO", "PTRO", "BUMI"],
        "cpo": ["LSIP", "AALI", "BWPT"],
        "banks": ["BBRI", "BMRI", "BBNI"],
        "ev": ["VKTR", "BRPT", "WIFI"],
        "speculative": ["INET", "IRSX"],
    })

    def conviction_boosts(self) -> Dict[str, float]:
        boosts = {squad: 1.0 for squad in self.squad_map}

        if self.macro_vibe == "Weak_Rupiah":
            boosts["energy"] = 1.10
            boosts["cpo"] = 1.10
            boosts["banks"] = 0.92

        return boosts

    def score_ticker(self, ticker: str) -> float:
        squad = self.ticker_to_squad(ticker)
        base_score = 0.55
        return round(base_score * self.conviction_boosts().get(squad, 1.0), 4)

    def ticker_to_squad(self, ticker: str) -> str:
        for squad, squad_tickers in self.squad_map.items():
            if ticker in squad_tickers:
                return squad
        return "unknown"


if __name__ == "__main__":
    analyst = SectorAnalyst(["ADRO", "BBRI", "LSIP"], "Weak_Rupiah")
    print(analyst.conviction_boosts())
    print({ticker: analyst.score_ticker(ticker) for ticker in analyst.tickers})