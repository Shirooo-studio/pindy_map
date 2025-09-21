class ProfilesController < ApplicationController
  before_action :authenticate_user!

  def show
    respond_to do |format|
      format.json do
        u = current_user
        render json: {
          username: u.username,
          display_name: u.try(:full_name),
          company: u.try(:company),
          department: u.try(:department),
          work_location: u.try(:work_location),
          bio: u.try(:bio)
        }
      end
      format.html { redirect_to edit_profile_path }
    end
  end

  def new
    redirect_to root_path and return if current_user.profile_completed?
    @user = current_user
  end

  def create
    @user = current_user
    if @user.update(profile_params_html.merge(profile_completed: true))
      redirect_to root_path, notice: "アカウント情報を登録しました。"
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
    @user = current_user
  end

  def update
    @user = current_user
    respond_to do |format|
      format.html do
        if @user.update(profile_params_html)
          redirect_to root_path, notice: "更新しました。"
        else
          render :edit, status: :unprocessable_entity
        end
      end

      format.json do
        if @user.update(profile_params_json)
          render json: { ok: true}
        else
          render json: { errors: @user.errors.full_messages }, status: :unprocessable_entity
        end
      end
    end
  end

  private
  def profile_params_html
    params.require(:user).permit(:username, :full_name, :company, :work_location, :department, :bio)
  end

  def profile_params_json
    p = params.require(:profile).permit(:username, :display_name, :full_name, :company, :work_location, :department, :bio)
    p[:full_name] ||= p.delete(:display_name) if p.key?(:display_name)
    p
  end
end
