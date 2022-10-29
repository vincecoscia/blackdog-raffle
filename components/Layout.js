import { Montserrat } from "@next/font/google";
import Header from "./Header";
// If loading a variable font, you don't need to specify the font weight
const montserrat = Montserrat({ subsets: ["latin"] });

export default function RootLayout({ children }) {
  return (
    <div lang="en" className={montserrat.className}>
      <Header />
      <div className="mx-5 py-8 lg:mx-36 md:mx-20 text-white">
        <div className="container">{children}</div>
      </div>
    </div>
  );
}
