import { action, observable, Lambda, autorun } from "mobx";
import { Disposable } from "./Disposable";
import { json } from "./json";

export class Undo implements Undo, Disposable {

    @observable.shallow private undoStack: any[] = [];
    @observable.shallow private redoStack: any[] = [];

    private enabled = false;
    private currentState: any;
    private quit: Lambda;

    constructor(private state: any,
                private transactionCompleted?: (currentState: any, previousState: any) => void) {

        this.quit = autorun(() => this.observe());
    }

    dispose() {
        this.quit();
    }

    private observe() {
        const newState = json.save(this.state);
        if (!this.enabled) {
            this.enabled = true;            
        } else {
            this.redoStack.length = 0;
            this.undoStack.push(this.currentState);
        }

        const previousState = this.currentState;
        this.currentState = newState;

        if (this.transactionCompleted) {
            this.transactionCompleted(this.currentState, previousState);
        }
    }

    private swap(source: any[], target: any[]): void {
        var popped = source.pop();
        if (popped) {
            target.push(this.currentState);
            this.enabled = false;
            json.load(this.state, popped);
        }
    }

    get canUndo() {
        return !!this.undoStack.length;
    }

    @action.bound
    undo() {
        this.swap(this.undoStack, this.redoStack);
    }

    get canRedo() {
        return !!this.redoStack.length;
    }

    @action.bound
    redo() {
        this.swap(this.redoStack, this.undoStack);
    }
}
