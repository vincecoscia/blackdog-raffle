import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { getSession } from "next-auth/react";
import { API_URL } from "../config/index";
import { useState } from "react";
import Employees from "../components/Employees";
import RaffleSlotMachine from '../components/RaffleSlotMachine';

export default function Home(props) {
  const { data: session } = useSession();
  const [winner, setWinner] = useState(null);
  const [entries, setEntries] = useState(0);
  const [employees, setEmployees] = useState(props.employees?.data ?? []);

  const refetchEmployees = async () => {
    // Make an API call to get the latest employee data
    const res = await fetch(`${API_URL}/api/employees`);
    const data = await res.json();

    // Sorting employees by first name
    data.data.sort((a, b) => {
      if (a.firstName < b.firstName) {
        return -1;
      }
      if (a.firstName > b.firstName) {
        return 1;
      }
      return 0;
    });

    setEmployees(data.data);
  };

  const handleReset = async () => {
    const res = await fetch(`${API_URL}/api/reset-entries`, {
      method: "PUT",
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message);
    } else {
      refetchEmployees();
    }
  };


  const handleRaffleCompleted = (winner) => {
    console.log('Raffle completed. Winner:', winner.firstName);
    // Here, you can implement additional logic, such as updating the database
  };

  if (!session) {
    props= null;
  }

  console.log(props)

  // request the number of entries from the API
  const getEntries = async () => {
    const res = await fetch(`${API_URL}/api/employees`);
    const data = await res.json();
    return data;
  };
  

  const chooseWinner = async (employees) => {
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
        console.log(winner)
        const res = await fetch(`${API_URL}/api/raffle`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ winner, date: new Date().toLocaleDateString() }),
        });

        if (!res.ok) {
          console.log("error");
        } else {
          const raffle = await res.json();
          console.log(raffle);
        }
        setWinner(winner);
        break;
      }
    }
    return winner;
  };

  const setAllEntries = async (employees, entries) => {
    for (let i = 0; i < employees.length; i++) {
      const res = await fetch(`${API_URL}/api/employees/${employees[i]._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ entries }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message);
      }
    }
  }

  if (session) {
    return (
      <div className="container min-w-full overflow-x-hidden lg:overflow-x-auto">
        {/* If Winner exists display here */}
        {/* {winner ? (
          <div className="bg-green-700 text-white font-bold py-2 px-4 rounded mb-5 w-fit">
            <h1>
              Winner: {winner.firstName} {winner.lastName}
            </h1>
          </div>
        ) : null} */}
        <div className="flex justify-center mb-8">
          <RaffleSlotMachine employees={employees} onRaffleCompleted={handleRaffleCompleted} />
        </div>
        <div className="flex gap-x-5 flex-col lg:flex-row gap-y-4">
          <div className="flex gap-x-5">
        <Link href="/employee/create">
          <button className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded">
            Add Employee
          </button>
        </Link>
        <button onClick={handleReset} className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
          Reset Entries
        </button>
        </div>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const entries = e.target.elements.entries.value;
          await setAllEntries(employees, entries);
          refetchEmployees();
        }}>
          {/* Set Entries to input */}
          <input
            className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-l"
            type="number"
            name="entries"
            placeholder="0"
            min="0"
            max="100"
          />
          <button className="bg-green-800 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-r">
            Set All Entries
          </button>
        </form>
        </div>


        <div className="flex">
          <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6 my-5 w-full">
            {employees.length > 0 ? (
              employees.map((employee) => (
                <Employees
                  key={employee._id}
                  employee={employee}
                  loading={props.loading}
                  refetch={refetchEmployees}
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

export async function getServerSideProps(ctx) {
  const session = await getSession(ctx);

  if (!session) {
    return {
      props: {},
    };
  }
  
  const res = await fetch(`${API_URL}/api/employees`);
  const employees = await res.json();

  // Sorting employees by first name
  employees.data.sort((a, b) => {
    if (a.firstName < b.firstName) {
      return -1;
    }
    if (a.firstName > b.firstName) {
      return 1;
    }
    return 0;
  });

  return {
    props: {
      employees,
    },
  };
}
