import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { API_URL } from "../config/index";
import { useState } from "react";
import Employees from "../components/Employees";

export default function Home(props) {
  const { data: session } = useSession();
  const [winner, setWinner] = useState(null);

  // request the number of entries from the API
  const getEntries = async () => {
    const res = await fetch(`${API_URL}/api/employees`);
    const data = await res.json();
    return data;
  };

  // Write a function that determines if the employee has won the raffle by choosing a random employee using the number of entries as the weight
  const chooseWinner = (employees) => {
    let totalEntries = 0;
    employees.forEach((employee) => {
      totalEntries += employee.entries;
    });
    let randomNum = Math.floor(Math.random() * totalEntries);
    let winner = employees[0];
    let currentTotal = 0;
    for (let i = 0; i < employees.length; i++) {
      currentTotal += employees[i].entries;
      if (randomNum < currentTotal) {
        winner = employees[i];
        setWinner(winner);
        break;
      }
    }
    console.log(winner);
    return winner;
  };
  if (session) {
    return (
      <div className="container min-w-full">
        {/* If Winner exists display here */}
        {winner ? (
          <div className="bg-green-700 text-white font-bold py-2 px-4 rounded mb-5 w-fit">
            <h1>
              Winner: {winner.firstName} {winner.lastName}
            </h1>
          </div>
        ) : null}
        <Link href="/employee/create">
          <button className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded mr-5">
            Add Employee
          </button>
        </Link>
        <button
          className="bg-blue-800 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          onClick={() =>
            getEntries().then((employees) => chooseWinner(employees.data))
          }
        >
          Choose Winner
        </button>

        <div className="flex">
          <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6 my-5 w-full">
            {props.employees.data.length > 0 ? (
              // Make stlyed profile cards for each employee with their image on the left, and firstName and lastName on the right
              props.employees.data.map((employee) => (
                <Employees
                  key={employee._id}
                  employee={employee}
                  loading={props.loading}
                />
              ))
            ) : (
              <h3>No Employees</h3>
            )}
          </div>
        </div>
      </div>
    );
  } else {
    return (
      <div className="container min-w-full">
        <div className="w-full flex justify-center flex-col items-center">
          <h2 className="text-lg">Welcome to Blackdog Raffle!</h2>
          <p className="text-sm mb-10">Please sign in to continue</p>
          <button
            className="bg-blue-800 hover:bg-blue-700 text-white py-2 px-16 rounded"
            onClick={() => signIn("google")}
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }
}

export async function getServerSideProps() {
  console.log(API_URL);
  const res = await fetch(`${API_URL}/api/employees`);
  const employees = await res.json();

  return {
    props: {
      employees,
    },
  };
}
