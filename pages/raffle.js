// pages/raffle.js
import React, { useState } from 'react';
import { getSession } from 'next-auth/react';
import { API_URL } from '../config/index';
import RaffleSlotMachine from '../components/RaffleSlotMachine';

const RafflePage = (props) => {
  const employees = props.employees.data;

  console.log(employees)

  const handleRaffleCompleted = (winner) => {
    console.log('Raffle completed. Winner:', winner.firstName);
    // Here, you can implement additional logic, such as updating the database
  };

  return (
    <div className="app-container">
      <RaffleSlotMachine employees={employees} onRaffleCompleted={handleRaffleCompleted} />
    </div>
  );
};

export default RafflePage;

export async function getServerSideProps(ctx) {
  const session = await getSession(ctx);

  if (!session) {
    return {
      props: {},
    };
  }
  
  const res = await fetch(`${API_URL}/api/employees`);
  const employees = await res.json();

  return {
    props: {
      employees,
    },
  };
}