import * as React from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import { useTheme } from '../../context/themeContext';

import BTN_delete from "../BasicButton/BasicButtons";
import TextField from "../Textfield/TextFieldTicket";

import "./TableListeStyle.css";

export default function TableListReactif_delBtn({
  TabLisHead,
  TabListBody,
  onRowClick,
  Numbers,
  onDeleteClick,
  onQtyChange,
}) {
  const { theme } = useTheme();

  return (
    <TableContainer
      className={theme === "light" ? 'TableListContainer' : 'TableListContainerDark'}
      component={Paper}
      sx={{ maxHeight: "100%", maxWidth: "100%" }}
    >
      <Table
        sx={{ minWidth: 65, backgroundColor: theme === "light" ? "var(--whiteBe)" : "var(--darkBodyColor)" }}
        stickyHeader
        aria-label="simple table"
      >
        <TableHead>
          <TableRow>
            {TabLisHead.map((title, index) => (
              <TableCell
                key={title}
                align={index === 0 ? "left" : "center"}
                sx={{
                  color: theme === "light" ? "var(--noirbe)" : "var(--whiteBeMax)",
                  position: 'sticky',
                  top: 0,
                  backgroundColor: theme === "light" ? "var(--whiteBeMax)" : "var(--noirbe)",
                  zIndex: 1,
                }}
              >
                {title}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {TabListBody.map((row) => (
            <TableRow
              key={row.ID}
              sx={{
                '&:last-child td, &:last-child th': { border: 0 },
                "td ": { color: theme === "light" ? "var(--noirbe)" : "var(--whiteBeMax)" },
                cursor: "pointer"
              }}
              onClick={() => onRowClick && onRowClick(row.ID)}
            >
              <TableCell sx={{ opacity: 0.8, display: Numbers >= 1 ? "" : "none" }}>
                {row.designation}
              </TableCell>
              <TableCell align='center' sx={{ opacity: 0.8, display: Numbers >= 3 ? "" : "none" }}>
                <TextField
                  Width={"100%"}
                  Placeholder={"Qt"}
                  value={row.qt}
                  onChangeValue={(value) => onQtyChange && onQtyChange(row.ID, value)}
                />
              </TableCell>
              <TableCell align='center' sx={{ opacity: 0.8, display: Numbers >= 4 ? "" : "none" }}>
                {row.mesure}
              </TableCell>
              <TableCell align='center' sx={{ opacity: 0.8, display: Numbers >= 6 ? "" : "none" }}>
                {row.vente}
              </TableCell>
              <TableCell align='center' sx={{ opacity: 0.8, display: "flex", justifyContent: "center" }}>
                <BTN_delete
                  variant={"outlined"}
                  color={"var(--ThemClaire)"}
                  colorH={"var(--white)"}
                  bgColor={"transparent"}
                  bgColorH={"var(--ThemClaire)"}
                  bgColorA={"var(--ThemClaire)"}
                  brdrColor={"var(--ThemClaire)"}
                  brdrColorH={"var(--ThemClaire)"}
                  textBtn={"Enlever"}
                  width={100}
                  padding={"7.7px 0px 10px 0px"}
                  onClick={() => onDeleteClick && onDeleteClick(row.ID)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
