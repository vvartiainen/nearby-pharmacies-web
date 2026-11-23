{
  description = "Nearby Pharmacies web development tools";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

  outputs =
    { nixpkgs, ... }:
    {
      devShells =
        nixpkgs.lib.genAttrs
          [
            "aarch64-darwin"
            "aarch64-linux"
            "x86_64-linux"
          ]
          (
            system:
            let
              pkgs = nixpkgs.legacyPackages.${system};
            in
            {
              default = pkgs.mkShellNoCC {
                packages = with pkgs; [
                  betterleaks
                  corepack_24
                  git
                  jq
                  nodejs_24
                  python3
                ];
              };
            }
          );
    };
}
