import Link from "next/link";
import { API_URL } from "../config/index";
import { useState } from "react";
import Employees from "../components/Employees";
import Modal from "../components/modal";

export default function Home(props) {
  const [winner, setWinner] = useState(null);

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

  return (
    <div>
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
        className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded"
        onClick={() => chooseWinner(props.employees.data)}
      >
        Choose Winner
      </button>

      <div className="flex">
        <div className="grid lg:grid-cols-3 gap-6 my-5 w-full">
          {props.employees.data.length > 0 ? (
            // Make stlyed profile cards for each employee with their image on the left, and firstName and lastName on the right
            props.employees.data.map((employee) => (
              <Employees key={employee._id} props={employee}/>
            ))
          ) : (
            <h3>No Employees</h3>
          )}
        </div>
      </div>
    </div>
  );
}

export async function getServerSideProps() {
  console.log(API_URL);
  const res = await fetch(`${API_URL}/api/employees`);
  const employees = await res.json();
  console.log(employees);

  return {
    props: {
      employees,
    },
  };
}
