import "../styles/globals.css";
import Header from "../components/Header";
import Layout from "../components/Layout";
import Nav from "../components/Nav";
import Router from "next/router";
import React from "react";

function MyApp({ Component, pageProps }) {
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => {
    const start = () => {
      console.log("start");
      setLoading(true);
    };
    const end = () => {
      console.log("finished");
      setLoading(false);
    };
    Router.events.on("routeChangeStart", start);
    Router.events.on("routeChangeComplete", end);
    Router.events.on("routeChangeError", end);
    return () => {
      Router.events.off("routeChangeStart", start);
      Router.events.off("routeChangeComplete", end);
      Router.events.off("routeChangeError", end);
    };
  }, []);
  return (
    <>
      {loading ? (
        <div>
        <Nav />
        <div className="mx-auto mt-10">
        <div className="lds-ellipsis"><div></div><div></div><div></div><div></div></div>
        </div>
        </div>
      ) : (
        <div>
          <Nav />
          <Layout>
            <Component {...pageProps} />
          </Layout>
        </div>
      )}
    </>
  );
}

export default MyApp;
