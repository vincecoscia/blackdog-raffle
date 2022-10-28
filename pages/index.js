import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { API_URL } from "../config/index";
import { useRouter } from "next/router";
import { useState } from "react";
import Employees from "../components/Employees";

export default function Home(props) {

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
        break;
      }
    }
    console.log(winner);
    return winner;
  };
  
  return (
    <div>
      <Link href="/employee/create">
        <button className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded">
          Add Employee
        </button>
      </Link>
      <div className="grid lg:grid-cols-3 gap-6 mt-5">
        {props.employees.data.length > 0 ? (
          // Make stlyed profile cards for each employee with their image on the left, and firstName and lastName on the right
          props.employees.data.map((employee) => (
            <Employees key={employee._id} props={employee} />
          ))
        ) : (
          <h3>No Employees</h3>
        )}
        <button className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded" onClick={() => chooseWinner(props.employees.data)}>
          Choose Winner
        </button>
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
