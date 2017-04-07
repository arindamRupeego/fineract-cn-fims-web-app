/**
 * Copyright 2017 The Mifos Initiative.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {JournalEntry} from '../../../../services/accounting/domain/journal-entry.model';
import {FormComponent} from '../../../../components/forms/form.component';
import {Component, OnInit, ViewChild, OnDestroy} from '@angular/core';
import {FormBuilder, Validators, FormControl, FormGroup, FormArray} from '@angular/forms';
import {Router, ActivatedRoute} from '@angular/router';
import {TdStepComponent} from '@covalent/core';
import {Creditor} from '../../../../services/accounting/domain/creditor.model';
import {Debtor} from '../../../../services/accounting/domain/debtor.model';
import {FetchRequest} from '../../../../services/domain/paging/fetch-request.model';
import {Account} from '../../../../services/accounting/domain/account.model';
import {Observable, Subscription} from 'rxjs';
import {toLongISOString} from '../../../../services/domain/date.converter';
import {FimsValidators} from '../../../../components/validator/validators';
import * as fromAccounting from '../../store';
import * as fromRoot from '../../../reducers';
import {CREATE} from '../../store/ledger/journal-entry/journal-entry.actions';
import {Error} from '../../../../services/domain/error.model';
import {SEARCH} from '../../../reducers/account/account.actions';
import {AccountingStore} from '../../store/index';
import {JournalEntryValidators} from './journal-entry.validator';

@Component({
  selector: 'fims-journal-entry-form-component',
  templateUrl: './form.component.html'
})
export class JournalEntryFormComponent extends FormComponent<JournalEntry> implements OnInit, OnDestroy {

  private formStateSubscription: Subscription;

  private userNameSubscription: Subscription;

  @ViewChild('detailsStep') detailsStep: TdStepComponent;

  selectedClerk: string;

  term = new FormControl();

  accounts: Observable<Account[]>;

  constructor(private formBuilder: FormBuilder, private router: Router, private route: ActivatedRoute, private store: AccountingStore) {
    super();
  }

  get formData(): JournalEntry {
    return null;
  }

  ngOnInit(): void {
    this.formStateSubscription = this.store.select(fromAccounting.getJournalEntryFormState)
      .subscribe((payload: {error: Error}) => {

        if(!payload.error) return;

        switch (payload.error.status) {
          case 400:
            //This should not happen
            break;
          case 409:
            this.setError('transactionIdentifier', 'unique', true);
            break;
        }
      });

    this.accounts = this.store.select(fromRoot.getAccountSearchResults)
      .map(accountPage => accountPage.accounts);

    this.detailsStep.open();

    this.userNameSubscription = this.store.select(fromRoot.getUsername).subscribe(username => this.selectedClerk = username);

    this.form = this.formBuilder.group({
      transactionIdentifier: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(32), FimsValidators.urlSafe()]],
      transactionDate: [new Date().toISOString().slice(0, 10), Validators.required],
      note: [''],
      message: [''],
      creditors: this.formBuilder.array([], JournalEntryValidators.minItems(1)),
      debtors: this.formBuilder.array([], JournalEntryValidators.minItems(1))
    }, { validator: JournalEntryValidators.equalSum('creditors', 'debtors') });

    this.term.valueChanges
      .debounceTime(500)
      .subscribe((event) => this.onAccountSearch(event));

    this.onAccountSearch();
  }

  ngOnDestroy(): void {
    this.formStateSubscription.unsubscribe();
    this.userNameSubscription.unsubscribe();
  }

  onClerkSelectionChange(selections: string[]): void {
    this.selectedClerk = selections[0];
  }

  save(): void {
    let transactionDateString = toLongISOString(this.form.get('transactionDate').value);

    let journalEntry: JournalEntry = {
      transactionIdentifier: this.form.get('transactionIdentifier').value,
      transactionDate: transactionDateString,
      clerk: this.selectedClerk,
      note: this.form.get('note').value,
      message: this.form.get('message').value,
      creditors: this.form.get('creditors').value,
      debtors: this.form.get('debtors').value,
    };

    this.store.dispatch({ type: CREATE, payload: {
      journalEntry,
      activatedRoute: this.route
    } });
  }

  addCreditor(accountNumber: string): void {
    const control: FormArray = this.form.get('creditors') as FormArray;
    control.push(this.initCreditor(accountNumber));
  }

  removeCreditor(index: number): void {
    const control: FormArray = this.form.get('creditors') as FormArray;
    control.removeAt(index);
  }

  addDebtor(accountNumber: string): void {
    const control: FormArray = this.form.get('debtors') as FormArray;
    control.push(this.initDebtor(accountNumber));
  }

  removeDebtor(index: number): void {
    const control: FormArray = this.form.get('debtors') as FormArray;
    control.removeAt(index);
  }

  onCancel() {
    this.navigateAway();
  }

  navigateAway(): void {
    this.router.navigate(['../'], {relativeTo: this.route});
  }

  private onAccountSearch(searchTerm?: string): void{
    let fetchRequest: FetchRequest = {
      page: {
        pageIndex: 0,
        size: 5
      },
      searchTerm: searchTerm
    };

    this.store.dispatch({ type: SEARCH, payload: fetchRequest });
  }

  private initCreditor(accountNumber: string): FormGroup {
    return this.formBuilder.group({
      accountNumber: [accountNumber],
      amount: [0]
    })
  }

  private initDebtor(accountNumber: string): FormGroup {
    return this.formBuilder.group({
      accountNumber: [accountNumber],
      amount: [0]
    })
  }

}
