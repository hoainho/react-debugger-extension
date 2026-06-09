class ReactDebugger < Formula
  desc "Advanced debugging & performance optimization tool for ReactJS applications"
  homepage "https://github.com/hoainho/react-debugger-extension"
  url "https://registry.npmjs.org/@nhonh/react-debugger/-/react-debugger-2.1.2.tgz"
  sha256 "5398bdb6ce914c39d147ea52ba1d7d235d0292d49433dc077cbd1b58300f6f16"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", "--production", "--ignore-scripts"
    libexec.install Dir["*"]

    (bin/"react-debugger").write <<~SH
      #!/bin/sh
      exec node "#{libexec}/bin/cli.js" "$@"
    SH
  end

  test do
    assert_match "2.1", shell_output("#{bin}/react-debugger --version")
  end
end
