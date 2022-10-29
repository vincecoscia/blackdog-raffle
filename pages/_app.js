import "/styles/globals.css";
import Layout from "/components/Layout";
import Nav from "/components/Nav";
import Router from "next/router";
import React from "react";
import { Analytics } from '@vercel/analytics/react';

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
        <div className="">
          <Nav />
          <div className="flex justify-center items-center w-full h-screen md:h-full md:mt-24">
            <div className="lds-ellipsis">
              <div></div>
              <div></div>
              <div></div>
              <div></div>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <Nav />
          <Layout>
            <Component {...pageProps} loading={loading} />
          </Layout>
        </div>
      )}
      <Analytics/>
    </>
  );
}

export default MyApp;
