import './App.css';
import React, { useEffect, useReducer } from 'react';
// import { API } from 'aws-amplify';
import { List, Input, Button } from 'antd';
import 'antd/dist/reset.css';
import { listNotes } from './graphql/queries';
import { generateClient } from 'aws-amplify/api';
import { v4 as uuid } from 'uuid';
import {
  createNote as CreateNote,
  deleteNote as DeleteNote,
  updateNote as UpdateNote
}
  from './graphql/mutations';
import { onCreateNote } from './graphql/subscriptions';

const CLIENT_ID = uuid();

const initialState = {
  notes: [],
  loading: true,
  error: false,
  form: { name: '', description: '' }
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_NOTES':
      return { ...state, notes: action.notes, loading: false };
    case 'ADD_NOTE':
      return { ...state, notes: [action.note, ...state.notes] }
    case 'RESET_FORM':
      return { ...state, form: initialState.form }
    case 'SET_INPUT':
      return { ...state, form: { ...state.form, [action.name]: action.value } }
    case 'ERROR':
      return { ...state, loading: false, error: true };
    default:
      return { ...state };
  }
};

const App = () => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const client = generateClient();

  const variables = {
    filter: {
      completed: {
        eq: false
      }
    }
  };
  const variables2 = {
    filter: {
      completed: {
        eq: true
      }
    }
  };

  const fetchIncompleteNotes = async () => {
    try {
      const notesData = await client.graphql({
        query: listNotes, variables: variables
      });
      dispatch({ type: 'SET_NOTES', notes: notesData.data.listNotes.items });
    } catch (err) {
      console.error(err);
      dispatch({ type: 'ERROR' });
    }
  };

  const fetchCompletedNotes = async () => {
    try {
      const notesData = await client.graphql({
        query: listNotes, variables: variables2
      });
      dispatch({ type: 'SET_NOTES', notes: notesData.data.listNotes.items });
    } catch (err) {
      console.error(err);
      dispatch({ type: 'ERROR' });
    }
  };

  const fetchNotes = async () => {
    try {
      const notesData = await client.graphql({
        query: listNotes
      });
      dispatch({ type: 'SET_NOTES', notes: notesData.data.listNotes.items });
    } catch (err) {
      console.error(err);
      dispatch({ type: 'ERROR' });
    }
  };


  const createNote = async () => {
    const { form } = state

    if (!form.name || !form.description) {
      return alert('please enter a name and description')
    }

    const note = { ...form, clientID: CLIENT_ID, completed: false, id: uuid() }
    dispatch({ type: 'ADD_NOTE', note });
    dispatch({ type: 'RESET_FORM' });
    // console.log(note)
    try {
      await client.graphql({
        query: CreateNote,
        variables: { input: note }
      })
      console.log('successfully created note!')
    } catch (err) {
      console.error("error: ", err)
    }
  };

  const deleteNote = async ({ id }) => {
    const index = state.notes.findIndex(n => n.id === id)
    const notes = [
      ...state.notes.slice(0, index), // TODO add a filter?
      ...state.notes.slice(index + 1)];
    dispatch({ type: 'SET_NOTES', notes })
    try {
      await client.graphql({
        query: DeleteNote,
        variables: { input: { id } }
      })
      console.log('successfully deleted note!')
    } catch (err) {
      console.error(err)
    }
  };

  const updateNote = async (note) => {
    const index = state.notes.findIndex(n => n.id === note.id)
    const notes = [...state.notes]
    notes[index].completed = !note.completed
    dispatch({ type: 'SET_NOTES', notes })
    try {
      await client.graphql({
        query: UpdateNote,
        variables: { input: { id: note.id, completed: notes[index].completed } }
      })
      console.log('note successfully updated!')
    } catch (err) {
      console.errror(err)
    }
  };

  const onChange = (e) => {
    dispatch({ type: 'SET_INPUT', name: e.target.name, value: e.target.value });
  };

  useEffect(() => {
    fetchNotes();
    const subscription = client.graphql({
      query: onCreateNote
    })
      .subscribe({
        next: noteData => {
          console.log(noteData) // added for troublshooting
          const note = noteData.data.onCreateNote //"value" no longer needed
          if (CLIENT_ID === note.clientID) return
          dispatch({ type: 'ADD_NOTE', note })
        }
      })
    return () => subscription.unsubscribe();
  }, []);

  const styles = {
    container: { padding: 20 },
    input: { marginBottom: 10 },
    item: { textAlign: 'left' },
    p: { color: '#1890ff' },
  }

  function renderItem(item) {
    return (
      <List.Item
        style={styles.item}
        actions={[
          <button style={styles.p} onClick={() => deleteNote(item)}>Delete</button>,
          <button style={styles.p} onClick={() => updateNote(item)}>
            {item.completed ? 'Mark Incomplete' : 'Mark Completed'}
          </button>
        ]}>
        <List.Item.Meta
          title={item.name}
          description={item.description}
        />
      </List.Item>
    )
  };


  return (
    <div style={styles.container}>
      <Input
        onChange={onChange}
        value={state.form.name}
        placeholder="Note Name"
        name='name'
        style={styles.input}
      />
      <Input
        onChange={onChange}
        value={state.form.description}
        placeholder="Note description"
        name='description'
        style={styles.input}
      />
      <Button
        onClick={createNote}
        type="primary"
      >Create Note</Button>
      <br></br>

      <List
        loading={state.loading}
        dataSource={state.notes}
        renderItem={renderItem}
      />
      <Button
        onClick={fetchIncompleteNotes}
        type="primary"
      >Filter to Incomplete</Button>&nbsp;
      <Button
        onClick={fetchCompletedNotes}
        type="primary"
      >Filter to Complete</Button>&nbsp;
      <Button
        onClick={fetchNotes}
        type="primary"
      >Filter to All</Button>
    </div>
  );
}

export default App;
