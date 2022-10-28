// app/layout.tsx
import { Montserrat } from "@next/font/google";
import Header from "./Header";
// If loading a variable font, you don't need to specify the font weight
const montserrat = Montserrat({ subsets: ["latin"] });

export default function RootLayout({ children }) {
  return (
    <div lang="en" className={montserrat.className}>
      <Header />
      <div className="container mx-auto text-white">
        <div className="mx-5 py-8 lg:mx-48">{children}</div>
      </div>
    </div>
  );
}
