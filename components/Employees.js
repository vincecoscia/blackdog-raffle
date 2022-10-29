import Link from "next/link";
import Image from "next/image";
import {useState} from "react";
import { useRouter } from "next/router";
import { API_URL } from "../config/index";

export default function Employees(employee) {
  let employeeData = employee.props;

  const [values, setValues] = useState({
    entries: 0,
  });

  const router = useRouter();
  // Create a function that handles the input change and sets the value
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setValues({ ...values, [name]: value });
  };

  // create a function that handles the form submission
  const handleEntryUpdate = async (e) => {
    e.preventDefault();

    // Validation
    const hasEmptyFields = Object.values(values).some(
      (element) => element === ""
    );

    if (hasEmptyFields) {
      alert("Please fill in all fields");
    }

    const res = await fetch(`${API_URL}/api/employees/${e.target.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      console.log("error");
    } else {
      const employee = await res.json();
      router.push(`/`); 
      
    }
  };

  return (
    <div key={employeeData._id} className="bg-slate-800 rounded-lg shadow-lg p-5">
      <Link href={`/employee/${employeeData._id}`}>
        <div className="flex items-center">
          {employeeData.imageURL ? (
            <Image
              src={employeeData.imageURL}
              alt={employeeData.firstName}
              width={80}
              height={80}
              layout="fixed"
              style={{ width: "80px", height: "80px" }}
              className="rounded-full object-cover overflow-hidden"
            />
          ) : (
            <Image
              src="/assets/placeholder.jpg"
              alt={employeeData.firstName}
              width={80}
              height={80}
              layout="fixed"
              style={{ width: "80px", height: "80px" }}
              className="rounded-full object-cover overflow-hidden"
            />
          )}
          <div className="ml-3">
            <h3 className="text-lg font-bold">
              {employeeData.firstName} {employeeData.lastName}
            </h3>
            <p className="text-xs">{employeeData.email}</p>
          </div>
        </div>
      </Link>
      <div className="flex items-center mt-5">
        <div className="flex items-center">
          <p className="text-sm font-bold">Entries: </p>
          <p className="text-sm ml-2">{employeeData.entries}</p>
        </div>
      </div>
      <form
        className="flex items-center mt-5"
        onSubmit={handleEntryUpdate}
        id={employeeData._id}
      >
        <input
          type="number"
          name="entries"
          value={values.entries}
          onChange={handleInputChange}
          className="bg-slate-700 text-white rounded-lg p-2 w-24"
          placeholder={employeeData.entries}
        />
        <button
          type="submit"
          className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded ml-3"
        >
          Update Entries
        </button>
      </form>
    </div>
  );
}
