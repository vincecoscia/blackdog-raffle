import "@/styles/globals.css";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { Analytics } from "@vercel/analytics/next";
import { ToastContainer } from "react-toastify";
import Header from "@/components/Header";
import Layout from "@/components/Layout";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap",
  variable: "--font-bricolage",
});

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      {/* Expose the font families on :root so portals (dialogs, toasts) inherit them too. */}
      <style jsx global>{`
        :root {
          --font-inter: ${inter.style.fontFamily};
          --font-bricolage: ${display.style.fontFamily};
        }
      `}</style>
      <Header />
      <Layout>
        <Component {...pageProps} session={session} />
      </Layout>
      <ToastContainer
        position="bottom-right"
        theme="dark"
        autoClose={3500}
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable={false}
      />
      <Analytics />
    </SessionProvider>
  );
}
