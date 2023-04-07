import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/router";
import { API_URL } from "../config/index";
import Modal from "../components/Modal";

export default function Employees(props) {
  let [isOpen, setIsOpen] = useState(false);
  let [entries, setEntries] = useState(props.employee.entries);

  let employeeData = props.employee;

  const router = useRouter();

  function closeModal() {
    setIsOpen(false);
  }

  function openModal() {
    setIsOpen(true);
  }

  // Delete employees on button click
  async function deleteEmployee() {
    try {
      const res = await fetch(`${API_URL}/api/employees/${employeeData._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message);
      } else {
        setIsOpen(false);
        router.replace(router.asPath);
      }
    } catch (error) {
      console.log(error);
    }
  }

  const [values, setValues] = useState({
    entries: employeeData.entries,
  });

  // handles the input change and sets the value
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setValues({ ...values, [name]: value });
  };

  // handle the form submission
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
      setEntries(employee.data.entries);
      // router.replace(router.asPath);;
    }
  };

  return (
    <div
      key={employeeData._id}
      className="bg-slate-800 rounded-lg shadow-lg p-5"
    >
      {isOpen ? (
        <Modal
          closeModal={closeModal}
          deleteEmployee={deleteEmployee}
          isOpen
          employeeData={employeeData}
        />
      ) : null}
      <div className="flex justify-between">
        <div className="flex items-center">
          <Link href={`/employee/${employeeData._id}`}>
            {employeeData.imageURL ? (
              <Image
                src={employeeData.imageURL}
                alt={employeeData.firstName}
                width={50}
                height={50}
                layout="fixed"
                style={{ width: "50px", height: "50px" }}
                className="rounded-full object-cover overflow-hidden"
              />
            ) : (
              <Image
                src="/assets/placeholder.jpg"
                alt={employeeData.firstName}
                width={50}
                height={50}
                layout="fixed"
                style={{ width: "50px", height: "50px" }}
                className="rounded-full object-cover overflow-hidden"
              />
            )}
          </Link>
          <div className="ml-3">
            <h3 className="text-lg font-bold">
              {employeeData.firstName} {employeeData.lastName}
            </h3>
            <p className="text-xs">{employeeData.email}</p>
          </div>
        </div>
        <button onClick={openModal}>
          <Image
            src="/assets/delete.svg"
            alt="delete"
            width={20}
            height={20}
            layout="fixed"
            style={{ width: "20px", height: "20px" }}
            className="align-top mb-5"
          />
        </button>
      </div>
      <div className="flex items-center mt-5">
        <div className="flex items-center">
          <p className="text-sm font-bold">Current Entries: </p>
          <p className="text-sm ml-2">{entries}</p>
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
